# Real recovery drill — Backup #2 (INC-BKP-007)

**Status: PHASE 1 PASSED and PHASE 2 PASSED, both for real, against real
production data recovered from the real Cloudflare R2 bucket.** Two real
Phase 2 attempts failed safely first — at Step 4 (`ERROR: relation
"storage.buckets" does not exist`) and then at Step 5 (`ERROR: column
"email_confirmed_at" of relation "users" does not exist`) — both **before**
any data integrity was at risk, both root-caused, fixed, independently
re-reviewed, and re-tested in isolation before the next real attempt. The
run reported here used that fully-fixed procedure (now committed at
`scripts/backup/restore-drill.ps1`, superseding the scratchpad copy this
document originally pointed at) and completed with **PHASE 2 PASSED**. See
§9 for the evidence from this run, including what is confirmed by the
script's own pass/fail control flow versus what still needs the operator's
exact pasted output to document precisely, and §10 for what this run does
and does **not** demonstrate about the backup system as a whole.

## 0. What this validates

Backup #2 (run id `20261014T210341Z-a8f4b8`) reported `COMPLETE` for both
legs in GitHub Actions:

| Leg | File | SHA-256 (as reported) | Size |
|---|---|---|---|
| PostgreSQL | `20261014T210341Z-a8f4b8.postgres.sql.age` | `86e32f426b8d51c567d589251bb686b3d8e3c2bd62aeaeebd1aca199c39369df` | 30058 bytes |
| Storage | `20261014T210341Z-a8f4b8.snapshot.age` | `f6109a76bf810c9546a133d29efa9ac1b3aa9b3f5059e669f97d1c00cd84a0a7` | 1549 bytes |

Both hashes independently confirmed to be well-formed 64-character hex
SHA-256 strings (checked programmatically, not assumed). This drill does
**not** take those numbers on faith — §2 below independently re-downloads
both archives from R2 and recomputes their hashes itself, cross-checking
three sources at once (see §2).

This is the first time this specific backup pipeline is validated against
**real production data** and the **real Cloudflare R2 bucket** — every
prior validation (INC-BKP-001 through INC-BKP-006) used either a local
mock R2 server, synthetic seeded fixtures, or both. `docs/ops/activation-runbook.md`
§7 step 4 explicitly deferred this exact drill: *"recovering bytes
(read-only against R2) and restoring them into a live database are
different risk levels... the second should wait for a deliberate DR drill
scheduled on its own terms."* This is that drill.

## 1. Existing runbooks/scripts reviewed (requirement 1)

- `docs/ops/disaster-recovery-validation-findings.md` (INC-BKP-005) — the
  template this drill follows, but against a **mock** R2 server and
  **synthetic** seeded data at the time. Two real gotchas it already
  documented, both still relevant and accounted for below: `supabase db
  reset` does not clear Storage's file volume (irrelevant here — this
  drill never touches the existing local dev stack at all); and restoring
  Storage objects back into a live instance needs `x-upsert: true`
  (irrelevant here too — this drill verifies Storage object integrity
  on disk, it does **not** re-upload them to any Storage instance, local
  or remote — narrower and safer than what INC-BKP-005 exercised).
- `docs/ops/activation-runbook.md` §7 — the human checkpoint this drill
  fulfills (step 4's deferred "deliberate DR drill").
- `scripts/backup/shared/select-snapshot.mjs` — reused unmodified (the
  eligibility gate).
- `scripts/backup/shared/age-helpers.mjs` — reused unmodified
  (`decryptBuffer`), but see §6's open question about passphrase-protected
  identities.
- `scripts/backup/recover-from-destination.mjs` — reused as a design
  reference, not called directly (see §2 for why a new thin wrapper was
  written instead).
- `scripts/backup/storage/restore-storage-snapshot.mjs` — reused
  **unmodified**, via its exported `runRestore()`, for the Storage leg's
  full 3-layer verification (archive checksum → decrypt → per-object
  checksum).
- `scripts/backup/verify-referential-integrity.sql` — reused as its
  core logic (walks every FK constraint in `pg_constraint` generically;
  confirmed 140 constraints / 0 orphans in INC-BKP-005's own local run),
  but **modified this round** (independent review, §6/§9): added a
  `raise exception` when `total_bad > 0`, since the original version's
  `raise notice`-only summary never changed psql's own exit code — a real
  run with orphaned rows would have still printed "PHASE 2 PASSED". This
  is what makes §9's "0 orphans, confirmed by construction" claim actually
  true; the pre-fix version could not have supported that claim.

## 2. New script: `scripts/backup/validate-real-recovery.mjs` (requirements 2, 3, 4, 7)

Written and **tested** (against a local mock R2 server + a throwaway test
identity — never the real production identity or real R2 — same pattern
as `test-recover-from-destination.mjs`):

```
node scripts/backup/test-validate-real-recovery.mjs
5/5 passed
```

Why a new thin script instead of calling `recover-from-destination.mjs`
directly: that script already does select → download → decrypt → unpack
for both legs, but (a) never exposes the downloaded bytes' own hash for
an explicit, printed cross-check against what was reported from GitHub
Actions, and (b) never runs the Storage leg's **per-object** checksum
verification (`restore-storage-snapshot.mjs`'s `runRestore()`) — it only
unpacks. `validate-real-recovery.mjs` is a thin orchestrator that reuses
both existing modules' real logic unmodified, adding only:

1. **An explicit, printed 3-way hash cross-check per leg**: the summary
   manifest's own recorded hash, the hash recomputed from what was
   actually downloaded from R2 in this run, and the hash **you** reported
   from the GitHub Actions log (hardcoded into the drill script as the
   `expectedPostgresSha256`/`expectedStorageSha256` arguments). All three
   must agree — this is requirement 3, made visible and auditable rather
   than only an internal gate.
2. A forensic copy of both raw encrypted archives + their summaries,
   written to the local output directory (so `restore-storage-snapshot.mjs`'s
   own CLI could be re-run against them independently later, without a
   second R2 download).

This script never reads or prints the identity file's **contents** — it
only ever passes its file path to `decryptBuffer()`, which shells out to
the real `age` binary. No private key material passes through this
script, my own context, or this conversation at any point (requirement:
"no solicitar ni mostrar claves privadas").

## 3. Procedure — exact steps (requirements 2–7)

**Phase 0 (you, before running anything):** confirm whether either real
age identity file requires a passphrase (see §6 — this matters and isn't
yet confirmed).

**Phase 1 — download, cross-check, decrypt (no Docker yet):**
run `scripts/backup/validate-real-recovery.mjs` with the real run id, one
real identity file's path, and both hashes you reported. A phase-1-only
variant of this (read-only against R2, no Docker, nothing persisted) is
available as a standalone drill for reviewing the JSON output
(`postgresCrossCheck.match`, `storageCrossCheck.match`,
`storageRestoreStatus`) before deciding to proceed to Phase 2.

**Phase 2 — restore PostgreSQL into a disposable Docker container:**
the committed, parameterized script `scripts/backup/restore-drill.ps1`
(supersedes the earlier scratchpad copy this document originally pointed
at — same logic, now reviewed, generalized to accept any run id/hashes/
identity path as parameters instead of hardcoded values, and contains no
credentials, decrypted data, or real production values of its own) runs
Phase 1 again internally (its own output is never persisted between
phases) and then Phase 2:

1. Boots a **brand-new**, uniquely-named (`habitex-recovery-drill-<runId>`),
   `--rm` container from `public.ecr.aws/supabase/postgres:17.6.1.166` —
   the exact same image tag the existing local dev stack
   (`supabase_db_Habitex-v2`) already uses, confirmed cached locally, and
   confirmed to match the remote project's own PostgreSQL 17.6. No
   bind-mounted volume — nothing survives after the container stops.
   Different host port (55432) from the existing dev stack's 54322, so
   the two never collide.
2. **Bootstraps Supabase Storage's internal schema (added in INC-BKP-007,
   after a real run surfaced the gap — see §6).** The bare Postgres image
   alone never creates `storage.buckets`/`storage.objects`/
   `storage.foldername()` — only the `storage-api` service does, by
   self-migrating on first connect. This step: creates a dedicated,
   isolated Docker network (never the existing dev stack's network),
   sets a freshly-generated throwaway password for the (supautils-reserved)
   `supabase_storage_admin` role, runs a **throwaway**
   `storage-api:v1.77.5` container (same version the local dev stack
   already uses) on that network — publishing **no port** — until
   `storage.buckets`/`storage.objects`/`storage.foldername()` are
   confirmed present by name, then stops and removes that helper
   container and the network immediately.
3. **Bootstraps Supabase Auth's internal schema the same way (added after
   a SECOND real run surfaced this gap — see §6).** The earlier conclusion
   that "auth needs no bootstrap" was incomplete: it only checked what
   Habitex's *migrations* reference (`auth.users`/`auth.uid()`, both
   present in the bare image's older GoTrue schema), not what the real
   data **dump** contains — a data-only `pg_dump` of `auth.users` includes
   every column that table has in the real remote project (the full
   modern GoTrue v2.197.0 schema, 33 columns, including
   `email_confirmed_at`), not the ~20-column legacy schema baked into the
   base image. Same pattern as storage: a **throwaway** `gotrue:v2.197.0`
   helper (same version the local dev stack already uses) on the same
   isolated network, a throwaway password for the supautils-reserved
   `supabase_auth_admin` role, no published port, stopped and removed
   once `auth.users.email_confirmed_at` and the other core auth tables
   are confirmed present by name. Only then is the shared isolated
   network torn down. Also raises `log_min_error_statement` on the
   disposable Postgres container (via `supabase_admin`) before any real
   data is restored, so a later SQL error's full statement text — which
   could contain real row values — is never echoed into this script's own
   diagnostic logs; the error itself stays fully visible.
4. Replays every file under `supabase/migrations/` in filename order
   (the same order `supabase db reset` uses internally) via `psql -f`
   inside the container — building the schema from scratch, never from a
   schema dump (consistent with this pipeline's own design: the backup is
   always data-only).
5. Restores the decrypted, data-only dump from Phase 1, with
   `psql -v VERBOSITY=sqlstate` (added after a real run's error echoed
   fragments of its own failing statement directly to the console — see
   §6). A failing statement's error is reduced to its bare SQLSTATE code
   only — confirmed, against 4 real Postgres error classes including a
   NOT NULL violation's classic "Failing row contains (...)" full-row
   echo, that no value survives in any form while the error class itself
   (and the exit code) stay fully visible and actionable.
6. Runs `verify-referential-integrity.sql` (requirement 6 —
   tables/relationships; **modified this round**, not unmodified — see §1
   and §9 for why the `raise exception` added here is load-bearing for
   this document's own "0 orphans, confirmed by construction" claim).
7. Runs **aggregate row counts only** (`count(*)` per key table —
   `administrations`, `people`, `rental_relationships`, `charges`,
   `payments`, `files`, `storage.objects`, `auth.users`) — **never** a
   `SELECT *` or any query that could return literal row content, since
   this is real production data.

**Phase 3 — cleanup:** the container stops (and is removed, `--rm`); R2
credentials are cleared from the shell; the decrypted output directory
(plaintext SQL + unpacked Storage objects) remains on local disk only,
for you to review and delete yourself once satisfied.

## 4. Storage leg validation specifically (requirement 7)

Handled entirely within Phase 1, by `restore-storage-snapshot.mjs`'s
existing, unmodified 3-layer verification:
1. Archive-level: encrypted file's sha256 vs. the summary's recorded
   value.
2. Decryption: `age -d` against the supplied identity.
3. Object-level: after unpacking, each of the 2 objects' own sha256
   recomputed and compared against `manifest.json`'s per-object recorded
   value (captured at backup time).

Result is `restoreStatus: "VERIFIED"` only if all layers pass for both
objects, with a per-object `MATCH`/`MISMATCH`/`MISSING_IN_RESTORE` result.
**No object is re-uploaded to any Storage instance** — this validates the
bytes on disk only, a deliberately narrower (and safer) scope than
INC-BKP-005's local drill, which did re-upload into the local dev stack.

## 5. What gets reported back vs. what never should (requirement 8)

**Safe to paste back to Claude or keep in any written report:**
Phase 1's JSON summary (hashes, match booleans, per-object bucket/path/
size/match-result — Storage paths in this app are UUID-keyed, not
literal names), the referential-integrity script's PASS/FAIL line, and
the Phase 2 aggregate row counts.

**Never to be pasted, screenshotted, or otherwise shared** — because
Backup #2 contains **real production data**, unlike every prior drill in
this project's history which used synthetic fixtures: any `SELECT *` or
row-content output, the decrypted plaintext SQL file's actual contents,
the unpacked Storage objects' actual file contents, any literal name,
email, address, or financial amount. The drill script is designed so
that nothing in its normal, successful path ever produces this — if a
step fails and you're tempted to debug by inspecting raw content, do that
locally, never in this conversation.

## 6. Limitations and open questions — honest, not glossed over

- **Passphrase-protected identity — unconfirmed, potentially blocking.**
  `age-helpers.mjs`'s `decryptBuffer()` pipes the ciphertext via the
  child process's stdin and captures stdout/stderr (`runPiped()`) — there
  is no interactive terminal left for `age` to prompt on if the identity
  file itself requires a passphrase. Every identity used in this
  project's testing so far (INC-BKP-003 through 005) was an unencrypted
  throwaway test identity generated with plain `age-keygen -o <file>`.
  Whether your **real** production identity files are passphrase-protected
  is not something I can verify without asking you directly, and I
  haven't assumed either way. If yours is, this drill's Phase 1 will
  likely hang or fail with an unhelpful error — **confirm this before
  running**, and if it is passphrase-protected, stop and flag it rather
  than working around it live, since fixing `age-helpers.mjs` to support
  an interactive passphrase prompt is a real code change requiring its
  own review, out of scope for this planning pass.
- **Schema self-initialization — empirically tested, found wrong for
  `storage` AND `auth`, and fixed (INC-BKP-007 §3.75/§3.8).** The original
  assumption above (base roles/schemas self-initialize on first boot
  regardless of how the container is started) turned out to be
  **incomplete in two separate real runs, not one**: the bare image's own
  `docker-entrypoint-initdb.d` scripts DO create an `auth` schema with
  *a* `users` table and the base roles — enough to satisfy what Habitex's
  own *migrations* reference (`auth.users`/`auth.uid()`) — but that
  schema is a much older, ~20-column GoTrue version, not what the real
  data **dump** contains (every column `auth.users` actually has in the
  real remote project at export time — the modern 33-column v2.197.0
  schema, including `email_confirmed_at`). `storage.buckets`/
  `storage.objects`/`storage.foldername()` are simpler: the bare image
  creates none of them at all. Both gaps share the same root mechanism:
  the owning Supabase **service** (`storage-api`, `gotrue`) self-migrates
  its own schema on first connect (confirmed directly from each one's own
  real logs — `"[Migrations] Running vector_store migrations"` and
  `"GoTrue migrations applied successfully"` respectively) — never the
  base Postgres image alone. Two separate real Phase 2 runs hit this,
  each confirming the failure mode predicted below is safe and loud, not
  silent or corrupting: first `ERROR: relation "storage.buckets" does not
  exist` (replaying `20260827100005_private_storage_rls.sql`), then —
  after the storage fix — `ERROR: column "email_confirmed_at" of
  relation "users" does not exist` (restoring the real dump itself, in
  Phase 2 step 5, **before** any row was actually written anywhere else).
  **Fix**: the drill script now runs two throwaway helpers in turn —
  `storage-api:v1.77.5` then `gotrue:v2.197.0` (both exact versions the
  local dev stack already uses) — on one shared isolated Docker network,
  confirms the specific named objects each one is responsible for exist,
  then removes both and the network before replaying migrations.
  **Caveat (requirement 10, stated explicitly, not glossed over): a
  matching table/object COUNT (or even confirming specific named objects
  exist) is not the same as a full structural comparison.** Column types,
  constraints, indexes, defaults, and RLS policies on the storage-api/
  gotrue-created tables were never diffed column-by-column against the
  real schemas in this project's own stack — only presence/absence of the
  specific objects already known to matter (confirmed via `grep` across
  `supabase/migrations/` for schema references, and via the two real
  failures themselves for data-dump content). A subtle version/schema
  drift in some OTHER column/table neither of those checks happens to
  cover, if one existed, would not be caught by this check; it would most
  likely still surface as a loud, specific error later (the same pattern
  both real failures already followed), not a silent divergence, but this
  has not been exhaustively verified either — a third such gap, in some
  other table, remains conceivable.
- **`psql`'s own direct, client-side error output is a separate exposure
  path from `log_min_error_statement` — found by explicit, adversarial
  testing, not assumed safe (INC-BKP-007, Phase 2 step 5).**
  `log_min_error_statement` (§3 step 3) only controls what the Postgres
  **server** writes to its own log file — it has no effect on what `psql`
  itself prints directly to the console when a `-f` script hits an error,
  which is a completely separate code path that was never covered by that
  fix. Tested deliberately against 4 real Postgres error classes with
  throwaway marker values standing in for real data: an undefined-column
  error (the exact class a real run hit) echoed a truncated fragment of
  the literal failing statement on a `LINE 1: ...` line; an invalid-UUID
  error printed the literal bad value **directly on the top-level
  `ERROR:` line itself** (disproving "just keep ERROR: lines" as a safe
  filtering strategy before it was ever used); a NOT NULL violation's
  `DETAIL: Failing row contains (...)` printed the **entire row's
  values**, not just the offending column; a duplicate-key violation's
  `DETAIL: Key (...)=(...) already exists` printed the conflicting key's
  value. **Fix**: `psql -v VERBOSITY=sqlstate` for step 5 specifically — a
  built-in psql option, not a custom text filter of untrusted error
  content — reduces every error report to its bare SQLSTATE code only.
  Confirmed, re-running all 4 cases above, that no marker value survived
  in any form while the SQLSTATE itself and the exit code both stayed
  fully informative. Step 4 was left untouched (schema-only, not real row
  data). Step 6 (independent review, LOW) also got `VERBOSITY=sqlstate`
  for defense-in-depth and consistency, even though it only ever emits
  aggregate names/counts via `RAISE NOTICE`/`RAISE EXCEPTION`, never a raw
  row. Step 7 remains untouched (aggregate counts only).
- **The Postgres server's own internal log is a SECOND, separate leak
  path from `psql`'s client-side output — also found by explicit,
  adversarial testing, not assumed safe (INC-BKP-007, Phase 2 `finally`
  block).** Raising `log_min_error_statement` (§3 step 3, before real
  data loads) only drops the `STATEMENT:` line from the server's own log.
  A later independent-review round added `log_error_verbosity = 'terse'`
  alongside it, which additionally drops `DETAIL`/`HINT`/`CONTEXT`/
  `QUERY` — but explicit testing (same throwaway-marker method, re-run
  against a disposable container with both settings applied) found this
  still isn't enough: for error classes where Postgres embeds the
  offending value directly in the **primary** message text rather than in
  `DETAIL` (confirmed concretely for `invalid input syntax for type uuid:
  "<marker>"`), that value reaches the server's log verbatim regardless —
  `terse` only trims the *additional* fields, never the message itself. A
  NOT NULL violation surfacing through `COPY ... FROM STDIN` (the actual
  mechanism a data-only restore uses, not a plain `INSERT`) was also
  explicitly tested this round and confirmed clean (no row values, on
  either output path) — closing a gap the original VERBOSITY=sqlstate
  testing round had left: it had only exercised simple-statement
  failures, not the real COPY-based load path Step 5 actually uses.
  **Fix**: the drill script's `finally` block now tracks whether Step 5
  had started loading real rows (`$realDataRestoreStarted`) and, if a
  failure happens at or after that point, withholds the verbatim
  container-log dump entirely in favor of a generic, redacted diagnostic
  (pointing the operator at psql's own already-safe SQLSTATE output and
  the dump's line number instead) — exactly the "redacted/generic
  diagnostic when message safety can't be guaranteed" fallback this
  requirement called for. Failures before that point (Steps 0–4, schema
  only) still get the full, real container-log dump, since no real row
  data exists yet to leak.
- **Step 3.8's own readiness check had a race condition, found by
  re-review, not a real failure yet.** The original polling loop waited
  for a single early-schema marker (`auth.users.email_confirmed_at`) and
  then immediately asserted the full expected object set in one shot, no
  further polling. GoTrue applies its migrations sequentially, and some
  of the checked tables (`mfa_factors`, `one_time_tokens`, `flow_state`)
  are created by later migrations than that column — so a run could hit a
  window where the single-column probe succeeds while GoTrue is still
  mid-migration, aborting with a false "missing objects" error (fails
  safe, before any real data is touched, but still flaky/non-deterministic
  for no real reason). **Fix**: the loop now polls for the *entire*
  expected table/column set directly, every iteration, instead of using
  one column as an early proxy for the rest.
- **This drill does not exercise a real restore into Supabase Storage.**
  Deliberately narrower than INC-BKP-005's own local drill (which did
  re-upload, surfacing the real `x-upsert: true` requirement). Re-running
  that specific step against a real (even if local/throwaway) Supabase
  Storage instance, with real production file bytes, is a larger,
  separate decision this plan does not request.
- **This does not exercise the authenticated-login/Playwright-E2E layer**
  INC-BKP-005's local drill did (`pnpm test:e2e:local`, 37 passed) —
  running Habitex's actual frontend against restored real production
  data, with real user credentials, is a meaningfully larger action than
  what this plan requests; left out deliberately, not forgotten.
- **D1 is still not resolved by this drill alone** (per
  `docs/ops/activation-runbook.md`'s own standing position) — this drill
  proves one specific backup *can* be recovered, not that the backup
  *process* is unconditionally reliable going forward.

## 7. Restrictions honored in this plan

No Supabase (remote or local dev stack) modified. No Cloudflare R2
modified (read-only `GetObject` calls only). No `db reset`/`db push`/
`migration repair` run anywhere. No existing local data deleted or
overwritten — the disposable container is entirely separate from the
existing `supabase_db_Habitex-v2` stack (different name, different port,
no shared volume). No commit/push performed for this plan or its scripts
pending approval. No private key, password, or token requested, shown,
or stored in this repository or in this conversation.

## 8. Files added

- `scripts/backup/validate-real-recovery.mjs` — Phase 1 orchestrator.
- `scripts/backup/test-validate-real-recovery.mjs` — 5/5 passing against a
  local mock R2 server with a throwaway test identity.
- `scripts/backup/restore-drill.ps1` — the committed, maintainable Phase 2
  drill script (parameterized: `-RunId`, `-ExpectedPostgresSha256`,
  `-ExpectedStorageSha256`, `-IdentityFilePath`, optional `-RepoRoot`/
  `-HostPort`). Contains no credentials, no decrypted data, and no
  hardcoded real production values — every drill-specific value is
  supplied fresh each invocation. Still requires being run by a human in
  their own interactive PowerShell window (masked R2 credential prompts;
  no real TTY available to an AI agent's own tool calls).
- `docs/ops/real-recovery-drill-plan.md` — this document.

## 9. Evidence from the real PHASE 2 PASSED run

Run id `20261014T210341Z-a8f4b8` (Backup #2, §0). The operator reported
the script's own final line, `=== PHASE 2 PASSED ===`, which — by the
script's own control flow (every step uses `Assert-LastExitCode`/`throw`
on any nonzero exit, and that line is only reached after every prior step,
in order, exits 0) — is itself evidence for everything below marked
**confirmed by construction**. Rows below marked **confirmed by pasted
evidence** reflect the operator's own literal output, transcribed exactly
as reported, not inferred.

| Check | Result | Basis |
|---|---|---|
| Postgres leg 3-way hash cross-check (summary manifest vs. re-downloaded bytes vs. the externally-reported hash) | **MATCH** | Confirmed by construction — `validate-real-recovery.mjs`'s `main()` sets a nonzero exit code if `postgresCrossCheck.match` is false, which would have thrown at Step 1, before Docker was ever touched. |
| Storage leg 3-way hash cross-check + per-object verification | **MATCH / VERIFIED**, both of the backup's 2 known objects | Confirmed by construction (same mechanism — `storageOk` gates the exit code) + the object count already established in an earlier Phase 1 run (§0/§4). |
| 55 migrations replayed (Step 4) | **All 55 applied without error** | Confirmed by construction — the replay script uses `set -e` per file and `psql -v ON_ERROR_STOP=1`; `supabase/migrations/` contains exactly 55 files (recounted at the time of this update). Any single failure would have thrown before Step 5 ever ran. |
| Data-only dump restored (Step 5) | **Completed without error** | Confirmed by construction — `ON_ERROR_STOP=1` + `Assert-LastExitCode` on the restore command. |
| Referential integrity (Step 6) | **0 constraints with orphaned rows** | Confirmed by construction (unchanged reasoning) **and** corroborated by pasted evidence: the operator's literal output was `psql:/tmp/verify-referential-integrity.sql:69: NOTICE:  00000` then `DO` — a `NOTICE` (not `ERROR`), meaning the `do $$ ... $$` block completed without raising the `raise exception` this script now contains for `total_bad > 0` (§1/§6). Note: because Step 6 was also given `-v VERBOSITY=sqlstate` this round (independent review, defense-in-depth), the notice's own informational text (the "FK constraints checked: X, with orphans: Y" line) is not visible in this output — only its bare SQLSTATE (`00000`, "successful completion") is. The exact checked/orphan counts from this specific run are therefore not available from this evidence; **0 orphans** is established by the control-flow argument already documented, not by reading a printed count. |
| Step 7 aggregate row counts | **Confirmed by pasted evidence**: `administrations=1`, `auth.users=2`, `charges=0`, `files=0`, `payments=0`, `people=2`, `rental_relationships=1`, `storage.objects=2` | Operator's literal `table_name\|row_count` output, transcribed exactly. |
| Cleanup — decrypted output directory, R2 credentials, disposable container | **Confirmed by pasted evidence**: `"Decrypted output directory deleted - nothing persisted on disk by this script."` / `"R2 credentials cleared from this shell session. Disposable container stopped (and removed, --rm)."` / the "AFTER" container listing's names matched the "BEFORE" baseline, with no recovery-drill container left running. | Operator's literal output, transcribed exactly. No `*** FAILED ***` line was reported. |
| Cleanup — isolated Docker network removal | **Evidence not available.** | The operator explicitly reported no independent check of the final Docker network listing exists for this run. Not inferred, not assumed — recorded here as a genuine gap in this run's evidence, not treated as a pass. |

**Noted, not part of this drill's own evidence**: the operator separately
reported pre-existing instability in a `supabase_vector` container,
unrelated to any container this drill creates or manages (this drill never
starts, stops, or touches `supabase_vector` at any step) — recorded here
for context only, out of scope for this document.

## 10. What this demonstrates vs. what is still pending

**Demonstrated by this run, for real, against real production data and the
real R2 bucket:**
- The encrypted backup (both legs) can be downloaded, 3-way hash
  cross-checked, and decrypted with a real recovery identity.
- The Storage leg's 2 real objects individually verify byte-for-byte
  against their own recorded per-object checksums (on disk — not
  re-uploaded to any Storage instance; see below).
- A disposable Postgres container, bootstrapped with throwaway
  storage-api and gotrue helpers (not the full Supabase CLI stack), can
  replay all 55 of Habitex's real migrations and then successfully
  restore the real, data-only production dump on top.
- Referential integrity holds across every FK constraint in the restored
  data (0 orphans).
- The whole procedure's safety mechanisms work as designed: no real row
  content, SQL statement text, or production credential was ever
  observed in this conversation; cleanup logic has been independently
  reviewed and (pending the evidence in §9's last row) is expected to
  leave no disposable container, network, or decrypted file behind.

**Still pending — not demonstrated by this drill, deliberately narrower in
scope (per §6 and §7):**
- **Operational restoration into a live Supabase Storage instance.** This
  drill verifies the Storage leg's bytes on disk; it never re-uploads them
  (INC-BKP-005's own local drill did, and is the template for what that
  would require — notably the `x-upsert: true` finding in
  `docs/ops/disaster-recovery-validation-findings.md` §6).
- **Comparison of restored data against the live origin.** This drill
  confirms internal consistency (hashes, referential integrity, aggregate
  counts) of the *recovered* data — it does not diff restored rows/objects
  against what currently exists in the real remote Supabase project. Doing
  that safely (read-only against the remote project) is a separate,
  explicit action not requested or performed here.
- **Full structural schema comparison for the bootstrapped Storage/Auth
  objects** (column types, constraints, indexes, RLS policies) against the
  real services' schemas — only named-object presence was checked (§6).
- **The authenticated-login/Playwright E2E layer** against restored data
  (INC-BKP-005's local drill exercised this; this real drill deliberately
  did not, per §6).
- **Daily/scheduled automation.** `BACKUP_AUTOMATION_ENABLED` remains
  unset and the cron trigger remains commented out — this drill validates
  that *one* specific backup *can* be recovered; it does not by itself
  authorize unattended, recurring backups. See §11 below for what
  activating that still requires.
- D1 (per `docs/ops/activation-runbook.md`'s standing position) is **not**
  resolved by a single successful drill alone — continued confidence
  requires this to keep holding on future runs, not just this one.

## 11. Pending validation plan and requirements before daily automation

This section intentionally does not authorize or schedule any further
action — it is the checklist a human would work through before deciding to
enable `BACKUP_AUTOMATION_ENABLED`.

**Before enabling automation:**
1. Independent review of `scripts/backup/restore-drill.ps1` (this
   increment) and this document, specifically security/reproducibility/
   cleanup (see below for the review requested this round).
2. Obtain and record the §9 "pending exact evidence" rows (Step 7 counts,
   cleanup confirmation) from this run, or re-run the drill once more if
   those can no longer be retrieved, before calling this specific
   `runId` fully closed.
3. Complete `docs/ops/activation-runbook.md` §9's own checklist in full —
   this drill satisfies that runbook's step 4 (the deferred "deliberate DR
   drill"), but every other item there (R2 Bucket Lock configuration, both
   real age identities' custody, all GitHub secrets set correctly, the §8/
   §8b connectivity smoke tests against the real bucket and the real
   Supavisor pooler) is independent of this drill and still needs its own
   checklist pass.
4. A human explicitly reviews this entire document, the activation
   runbook, and `docs/ops/disaster-recovery-validation-findings.md`, and
   decides whether the two real Phase 2 failures + fixes documented here
   change the risk calculus for turning on unattended, recurring backups
   (they should not block it — both were found and closed *before* any
   data integrity was ever at risk — but that is this human's judgment
   call to make, not this document's).
5. Even once all of the above hold, `docs/ops/activation-runbook.md` §9's
   own closing rule still applies: this authorizes at most **one** gated,
   manual, observed run — not the schedule. Enabling the cron is a later,
   separate decision made only after that one run is independently
   verified restorable.

**Explicitly not touched by this update, per this round's restrictions:**
the cron trigger remains commented out, `BACKUP_AUTOMATION_ENABLED` was
not changed, no remote Supabase project was modified, and nothing in this
round was committed or pushed without separate explicit authorization.
