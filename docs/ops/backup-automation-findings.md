# Backup automation — GitHub Actions, R2 & healthchecks.io (INC-BKP-004)

Status: investigation and local validation complete, **nothing enabled**.
Everything below ran exclusively against the local Supabase stack
(`backup_reader`, local Storage) and an in-process mock R2/S3 server
(`scripts/backup/shared/mock-r2-server.mjs`) — no real Cloudflare account,
bucket, or credential was created, no remote migration was applied, no
real backup ran against the remote Supabase project, and the GitHub
Actions workflow added by this increment is **not committed**, so there is
zero risk of its `workflow_dispatch` trigger (the only active one) firing
anywhere.

## 1. What this increment reuses vs. adds

Per this task's own instruction not to reimplement already-validated
components:

- **PostgreSQL export** (INC-BKP-002, `scripts/backup/export-postgres-data.sh`)
  is unchanged and unmodified. `scripts/backup/postgres/export-postgres-encrypted.mjs`
  spawns it exactly as-is via `bash`, captures its stdout in memory, and
  layers encryption + checksumming + run-id-based naming around it — it
  does not alter or duplicate the script's own `pg_dump` logic.
- **Storage export** (INC-BKP-003, `scripts/backup/storage/export-storage-snapshot.mjs`)
  is called directly as an imported function (`runExport`), unmodified
  except for one deliberate refactor (§2): its run-id generator and
  age/sha256 helpers were extracted to `scripts/backup/shared/` so the
  PostgreSQL leg could use the *identical* implementations rather than a
  second copy. The full existing Storage test suite
  (`test-storage-snapshot.mjs`) was re-run after that extraction to confirm
  it still passes unchanged — see §6.
- **New for this increment**: the R2/S3 client (`shared/s3-client.mjs`,
  real SigV4 signing, not yet exercised against a real R2 endpoint since
  none exists), the healthcheck client (`shared/healthcheck.mjs`), the
  orchestrator (`run-backup.mjs`), the mock R2 server used only for local
  testing, and the GitHub Actions workflow.

## 2. Shared-helper extraction

Before adding the PostgreSQL encryption wrapper, the age encrypt/decrypt
stdin/stdout pattern, the sha256 helper, and the run-id generator were
moved out of `storage/export-storage-snapshot.mjs` /
`storage/restore-storage-snapshot.mjs` into
`shared/age-helpers.mjs` / `shared/run-id.mjs` / `shared/errors.mjs`, with
the Storage scripts now importing and re-exporting from there (so nothing
that previously imported `generateRunId`/`EncryptionFailedError`/etc. from
the Storage scripts needs to change). This was necessary, not cosmetic:
the orchestrator needs the PostgreSQL and Storage legs to share the exact
same run id and the exact same encryption mechanism, which requires one
implementation, not two that happen to agree. The full INC-BKP-003 test
suite was re-run immediately after this refactor and still passes (§6)
before any new code was built on top of it.

## 3. Orchestration under one shared run id (step 2)

`run-backup.mjs`:
1. Generates one `runId` (or accepts an override, same convention as both
   existing scripts).
2. Runs the PostgreSQL leg and the Storage leg, each given that same
   `runId` explicitly — confirmed in testing that both legs' own summaries
   report the identical `runId` as the orchestrator's.
3. Each leg's failure is caught and isolated — a PostgreSQL failure does
   not prevent the Storage leg from running (and vice versa), confirmed by
   a dedicated test (§6).

## 4. Encryption before upload (step 3)

Both legs encrypt fully in memory before any network call toward the
destination exists in the code at all (the orchestrator calls each leg's
own export function, which already returns only encrypted bytes — the
orchestrator itself never has access to plaintext). The R2 upload step is
strictly "upload bytes that are already ciphertext."

## 5. Upload and verification of encrypted artifacts (step 4)

`uploadAndVerify()`: `putObject` with `If-None-Match: *` (atomic conditional
write — see §9 for why this matters more than it would with a plain PUT),
then immediately `getObject` and recompute sha256 against the pre-upload
value already recorded in that leg's own summary. A mismatch is recorded
as `verified: false`, never silently accepted.

**Real SigV4 signing, not a stub.** `shared/s3-client.mjs` implements the
actual AWS SigV4 algorithm (canonical request, string-to-sign, derived
signing key, HMAC-SHA256 signature) against Node's built-in `crypto` — no
AWS SDK dependency. Validated against `shared/mock-r2-server.mjs`, which
deliberately implements its **own, independently-written** signature
verification (not a call into the client's signer) — a match proves the
client produces a signature a different implementation of the same
published algorithm accepts, not merely that the code agrees with itself.
Also confirmed the mock genuinely rejects a wrong secret key (403), not
rubber-stamping every request.

**Precision added after independent review, on exactly what "independent"
covers**: the mock's independence is real for the HMAC/canonical-request/
signing-key derivation — but both the client and the mock reconstruct the
canonical request from the *literal* HTTP request-line path, so a bug in
how the client URI-encodes an object key would be shared by both sides
rather than caught. That gap was real: `encodeURIComponent` leaves
`! * ' ( )` unescaped, but AWS SigV4's own canonical-request rule requires
them percent-encoded too, and review built a working reproduction (a key
containing those characters) where the mock accepted an upload whose
canonical path differed, byte-for-byte, from what a real S3/R2 endpoint
would independently re-derive from the same decoded key. Not reachable by
this pipeline's own usage (object keys are always `<runId>/<runId>.<ext>`,
generated internally, never from arbitrary filenames), but `s3-client.mjs`
is written as a reusable client. **Fixed**: added `uriEncode()`, applying
AWS's exact escape rule on top of `encodeURIComponent`, plus the header-
value whitespace-collapsing step the published algorithm also requires
(previously only `.trim()`) in both the client and the mock's verifier.
Regression test added:
`shared/test-s3-client.mjs` (new — a key containing `! * ' ( ) ~` now
round-trips correctly; see §14).

## 6. Manifest `COMPLETE` only when both backups are verified (step 5)

`computeCombinedCompleteness()`:

```
COMPLETE  <- postgres.completeness === 'COMPLETE' && postgres.verified === true
          && storage.completeness  === 'COMPLETE' && storage.verified  === true
FAILED    <- either leg never produced an artifact at all (export/encrypt threw)
PARTIAL   <- both legs produced something, but at least one is incomplete
             (e.g. Storage had a missing object) or failed upload verification
```

An upload that succeeds but fails its post-upload checksum check is
**never** treated as equivalent to a verified one — confirmed by the
corruption test (§7) specifically asserting `completeness !== 'COMPLETE'`
in that case, not merely that an error was logged somewhere.

**Fixed after independent review**: `createS3Client(r2Config)` and the
staging-directory `mkdtemp()` both originally ran *before* the function's
own `try/finally`. Review built a live reproduction (`runBackup({ r2Config:
{} })`) showing that an incomplete R2 config threw straight out of
`runBackup()` — skipping the `/fail` healthcheck ping every other failure
path sends, and leaking the just-created staging directory (confirmed with
`ls` on the OS temp dir afterward). Both are now inside the same
try/catch/finally as the rest of the run: an error this early is recorded
with a top-level `error`/`errorType` and `completeness: "FAILED"`, the
`/fail` ping still fires, and the staging directory is still cleaned up
(guarded so cleanup itself never throws if `mkdtemp` was the thing that
failed). Regression test added in `test-run-backup.mjs` (§7).

Automated test suite (`scripts/backup/test-run-backup.mjs`, run manually —
same reasoning as the Storage suite, needs a live local stack + `age` +
Docker on this dev machine):

```
PASS  happy path: both legs share one run id, upload, verify, and combine to COMPLETE
PASS  negative: a missing Storage object (PARTIAL) prevents a COMPLETE combined manifest
PASS  negative: PostgreSQL leg failure (unreachable connection) is isolated, reported FAILED, never crashes the whole run
PASS  negative: post-upload corruption is caught by verify-after-upload, not silently reported COMPLETE
PASS  negative: collision at the destination (key already exists) is refused, not silently overwritten
PASS  healthcheck payload never includes paths, administration ids, or per-object checksums
PASS  regression (MEDIUM, independent review): a bad R2 config fails gracefully, with no leaked staging dir and no uncaught throw
PASS  unit: computeCombinedCompleteness state machine

8/8 passed
```

A new, dependency-light suite (`shared/test-s3-client.mjs`, no live stack
needed — pure in-process HTTP against the mock) covers the SigV4 client
directly:

```
PASS  put/get/head round-trip
PASS  conditional PUT (If-None-Match: *) rejects a collision atomically
PASS  an incorrect secret key is rejected by independent signature verification
PASS  regression (MEDIUM, independent review): object keys with ! * ' ( ) round-trip correctly

4/4 passed
```

Storage's own suite was re-run after the shared-helper refactor (§2):

```
10/10 passed (scripts/backup/storage/test-storage-snapshot.mjs, unchanged from INC-BKP-003)
```

## 7. Partial failure, corruption, and collision detection (step 6)

- **Partial failure**: a flaky-client wrapper (same deterministic technique
  as INC-BKP-003's own missing-object test) makes one real Storage object
  vanish between listing and download; the Storage leg reports `PARTIAL`
  and the combined manifest follows (§6, never `COMPLETE`).
- **PostgreSQL leg failure, isolated**: pointed `PGPORT` at an unreachable
  port — the leg fails, is recorded with its error message and type, and
  the Storage leg still ran and uploaded independently (confirmed, not
  assumed: the test asserts `result.storage.uploaded === true` in this
  exact scenario).
- **Corruption**: a wrapped S3 client that flips one byte on every `GET`
  (simulating transport/storage corruption between PUT and the verifying
  read) — `uploadAndVerify` catches it via the sha256 mismatch, both legs
  report `verified: false`, combined completeness is never `COMPLETE`.
- **Collision at the destination**: pre-populated the mock R2 bucket with
  an object at the exact key a run would use, then ran the orchestrator
  with that fixed run id. The conditional `If-None-Match: *` PUT is
  rejected (412 at the mock, surfaced as `R2CollisionError`), the leg is
  recorded `FAILED`, and — critically — the pre-existing object's content
  was confirmed unchanged afterward (not merely "an error was thrown," but
  "nothing was actually overwritten").

## 8. healthchecks.io, without sensitive information (step 7)

`shared/healthcheck.mjs` pings `/start` at the beginning of a run, then
either a plain success ping or `/fail` with a payload, following
healthchecks.io's own documented ping API. `toHealthcheckPayload()`
explicitly allow-lists which fields ever leave the process — run id,
completeness per leg, and Storage's own aggregate counts (object/download/
missing counts) — and is the only thing ever sent, never the full summary
object as-is (so a field added to that summary later doesn't silently
start leaking here too). A dedicated test constructs a summary containing
a real-shaped path and a checksum, runs it through `toHealthcheckPayload`,
and asserts neither string appears anywhere in the serialized payload.

The ping URL itself (which embeds a UUID that functions like a bearer
token) is read from an environment variable and never logged — even the
module's own error-logging path redacts it (`redactUrl()`) before printing.
If the URL is simply unset, the client no-ops rather than failing the
whole run over a missing monitoring integration.

## 9. Retention and R2 Bucket Lock configuration (step 8)

**This is this increment's own recommendation, not a reference to any
prior "approved" design** — independent review of INC-BKP-003 found that
an earlier version of that increment's own findings doc cited an
"already-approved Backup & DR architecture" for R2 that does not exist
anywhere verifiable in this repository or its git history, and was
corrected there. The same discipline applies here: nothing below is
presented as previously decided.

- **Conditional writes, not a try-then-check pattern**: `putObject(...,
  { ifNoneMatch: '*' })` is the real collision guard (§5/§7), analogous to
  the local pipelines' `{ flag: 'wx' }` exclusive file creation
  (INC-BKP-002/003) — both exist so the *write itself* is atomic, not a
  separate existence check racing against the write.
- **R2 Bucket Lock, recommended over relying on R2 API token scoping**: R2
  tokens cannot express "write without delete" as a distinct permission
  (confirmed by Cloudflare's own documented token permission model, not
  assumed) — a Bucket Lock (a retention policy independent of any
  credential) is the mechanism that actually prevents deletion for a
  configured period, regardless of what the backup job's own credential
  can technically do.
- **Retention window**: this increment does not itself define a pruning
  schedule (no scheduled runs exist yet — the workflow's `schedule:`
  trigger is commented out, §10). A Bucket Lock's retention period should
  be set to match whatever pruning cadence a future increment actually
  implements, decided together rather than independently, to avoid a lock
  window that contradicts the pruning logic's own assumptions.
- **Object key layout**: this increment's keys are `<runId>/<runId>.
  postgres.sql.age`, `<runId>/<runId>.postgres-manifest-summary.json`, and
  the equivalent pair for Storage — the same run id already used
  everywhere else in this pipeline, carried through to the destination
  layout unchanged.
- **Credential separation**: the R2 credential (destination, write access
  for upload) must remain distinct from `backup_reader` (PostgreSQL) and
  `service_role` (Storage, source reads) — three separate secrets, never
  one standing in for another.

## 10. The GitHub Actions workflow (step 1) — not enabled, two independent gates

`.github/workflows/backup.yml` (not committed):

- `permissions: contents: read` at the top level, nothing broader.
- **Gate 1**: the `schedule:` trigger is written as a YAML **comment**, not
  an active block guarded by a condition — GitHub only runs scheduled
  workflows from the default branch once merged, and this file isn't even
  committed, so there is no path by which this cron could fire from
  today's repository state regardless of what's inside the comment.
- **Gate 2**: the only active trigger, `workflow_dispatch`, requires typing
  the literal string `RUN` into a required input, AND the job's first real
  step checks a repository variable `BACKUP_AUTOMATION_ENABLED` and exits
  (failing, not silently skipping) unless it is exactly `"true"`. Both
  conditions are required — this is the explicit human-approval point the
  task asked for, satisfied by two independent checks rather than one.
- Secrets referenced (`BACKUP_PGHOST`, `BACKUP_SUPABASE_URL`,
  `BACKUP_AGE_RECIPIENTS`, `BACKUP_R2_*`, `BACKUP_HEALTHCHECKS_PING_URL`,
  etc. — full list in §12) do not exist in this repository and were not
  created by this increment. Referencing an undefined secret in a workflow
  file is not an error at definition time; it simply resolves to an empty
  string if the workflow ever ran, which it cannot (Gates 1 and 2).
- **`age` package availability, verified empirically, not just assumed**:
  the workflow installs `age` via `apt-get install age` on `ubuntu-latest`.
  This increment never ran a real GitHub Actions workflow (no remote
  operation was performed, per its restrictions), but independent review
  verified the underlying assumption directly: `docker run ubuntu:24.04`
  (the OS `ubuntu-latest` currently resolves to) followed by `apt-get
  update && apt-get install -y age` installed `age 1.1.1` cleanly from the
  default-enabled `universe` repository. Still worth one real (gated,
  non-scheduled) manual `workflow_dispatch` run before relying on this for
  a production backup, since a real GitHub-hosted runner's image could in
  principle differ from a bare `ubuntu:24.04` container — but the package
  itself is confirmed to exist and install correctly on this OS version.

## 11. A real environment finding, surfaced rather than worked around

While building the "PostgreSQL leg fails in isolation" test, a
deliberately wrong `PGPASSWORD` was accepted by the local stack —
confirmed directly (`psql` with `PGPASSWORD=totally-wrong-password`
against `backup_reader` succeeded, `current_user` returned `backup_reader`
with no error). **This local Supabase dev stack's `pg_hba.conf` uses trust
authentication for local/container connections** — password values are
not actually verified in this specific environment. This is a property of
the local dev stack's own default configuration, not a defect in
`backup_reader`'s own grants (already verified extensively in
INC-BKP-001/002) and not expected to hold against the real remote
project, which does enforce password authentication normally. The
corresponding test was changed to simulate failure via an unreachable
port instead (a failure mode this environment genuinely can produce),
and this finding is named here rather than quietly worked around.

## 11b. Reviewer findings and fixes

Independent review found 0 BLOCKER/HIGH, 3 MEDIUM, and 2 LOW — all against
actual code, with 2 of the MEDIUMs confirmed by a live executable
reproduction (not just inspection). All are fixed in the code and
documentation now described above:

- **MEDIUM — SigV4 URI-encoding gap** (`shared/s3-client.mjs`) — see §5.
- **MEDIUM — the mock's "independence" didn't cover URI-encoding**
  (`shared/mock-r2-server.mjs`) — same root cause as the one above; fixed
  by fixing the client (making the point moot) and by precisely scoping
  what "independent" means in both files' own comments and in §5 here,
  rather than letting the claim overstate its coverage.
- **MEDIUM — `createS3Client`/`mkdtemp` outside the try/finally**
  (`run-backup.mjs`) — see §6.
- **LOW — header-value normalization only trimmed, never collapsed
  internal whitespace** — not reachable today (the only signed headers
  never contain internal whitespace), but fixed in both the client and the
  mock for completeness against the published algorithm.
- **LOW — the findings doc's wording overstated the mock's independence**
  — fixed by the precision note added to §5.

Review also independently verified, with no findings: `computeCombinedCompleteness`'s
full state table (exhaustively walked, confirmed by the test suite),
`uploadAndVerify`'s re-download-and-compare logic (not an etag-trust
shortcut), that `export-postgres-encrypted.mjs` genuinely never
reimplements `export-postgres-data.sh`, that `toHealthcheckPayload` is a
real allowlist (tested by injecting sentinel values into fields outside
the allowlist and confirming they never appear in the serialized output),
that the workflow's two gates are independent AND-conditions with
`permissions: contents: read` as the only declared permission, and —
verified empirically by running `apt-get install -y age` inside a real
`ubuntu:24.04` container — that the workflow's assumption about `age`
being installable on `ubuntu-latest` is correct, not merely plausible.

## 12. Secrets and configuration required to activate (none created by this increment)

| Secret / variable | Purpose | Existing elsewhere? |
|---|---|---|
| `BACKUP_PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD` | Real `backup_reader` connection to the remote project | `backup_reader` role exists only locally (INC-BKP-001); remote creation needs separate human approval |
| `BACKUP_SUPABASE_URL`/`BACKUP_SUPABASE_SERVICE_ROLE_KEY` | Real Storage access | The real project's own values, never created here |
| `BACKUP_AGE_RECIPIENTS` | >= 2 real age public keys | None exist yet — this increment only ever used throwaway test identities, never committed |
| `BACKUP_R2_ENDPOINT`/`ACCESS_KEY_ID`/`SECRET_ACCESS_KEY`/`BUCKET` | Real R2 destination | No Cloudflare account/bucket/token exists — explicitly out of scope for this increment |
| `BACKUP_HEALTHCHECKS_PING_URL` | Optional; pipeline no-ops without it | No healthchecks.io account exists |
| `BACKUP_AUTOMATION_ENABLED` (repository **variable**, not secret) | Gate 2 kill switch | Does not exist; must be deliberately set to `"true"` |

## 13. Residual risks

1. **`age` availability on `ubuntu-latest`** — originally listed here as
   assumed-not-verified; independent review verified it empirically
   (`apt-get install -y age` inside a real `ubuntu:24.04` container
   succeeded, installing `age 1.1.1` from the default-enabled `universe`
   repo). Downgraded from "residual risk" to "confirmed," per §11b.
2. **The R2 client's SigV4 signing has never run against a real R2
   endpoint** — only against the independently-verifying local mock, whose
   independence now specifically covers the HMAC/canonical-request math
   (the URI-encoding gap it couldn't have caught was found and fixed, §5).
   R2 is documented as S3-API-compatible, but a real R2 account is the
   only way to close this gap completely.
3. **Local Postgres trust-auth (§11)** means this environment cannot
   locally validate that a real, wrong `backup_reader` password is
   actually rejected end-to-end through this orchestrator — only that an
   unreachable-connection failure is handled correctly. The remote
   project's own auth enforcement was not and cannot be tested from here.
4. **No multipart upload** in `s3-client.mjs` — fine for current data
   volume, a real limitation for a future very large snapshot.
5. **Retention/Bucket Lock window is unset** — deliberately, since no
   pruning schedule exists yet (§9).
6. Everything already named as residual in INC-BKP-002/003 (service_role's
   write capability on Storage, no remote validation yet, etc.) still
   applies unchanged.

## 14. Files created/modified this phase

- `scripts/backup/shared/{run-id,age-helpers,errors,s3-client,healthcheck,mock-r2-server}.mjs` — new.
- `scripts/backup/shared/test-s3-client.mjs` — new (dependency-light unit suite for the SigV4 client; added post-review).
- `scripts/backup/postgres/export-postgres-encrypted.mjs` — new.
- `scripts/backup/run-backup.mjs` — new (orchestrator; fixed post-review, §11b).
- `scripts/backup/test-run-backup.mjs` — new (automated test suite; regression test added post-review).
- `scripts/backup/storage/export-storage-snapshot.mjs`,
  `restore-storage-snapshot.mjs` — modified (shared-helper extraction, §2;
  re-ran the full existing test suite afterward, still 10/10).
- `.github/workflows/backup.yml` — new, **not committed**.
- `docs/ops/backup-automation-findings.md` — this document.

No application TypeScript touched. `pnpm typecheck`/`lint`/`test` confirmed
unaffected (see final report for the exact run).
