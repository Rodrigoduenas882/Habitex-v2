# Storage backup, encryption & snapshots — validation findings (INC-BKP-003)

Status: investigation and local validation complete. Everything below ran
**exclusively against the local Supabase stack** (`supabase start`,
container set `*_Habitex-v2`) using test fixtures uploaded by this
investigation itself, through the local Storage HTTP API with the
well-known, non-secret local `service_role` key that `supabase start`
prints on every run. Nothing here touched the remote project, created a
remote credential, or created any Cloudflare account/bucket. No real
recovery private key was used anywhere — both age identities used for
testing were generated fresh for this investigation
(`age-keygen`) and exist only under this session's scratchpad, never
committed.

## 1. Real Storage access pattern in Habitex (step 1)

Inspected `src/features/documents/infrastructure/supabase-file.repository.ts`,
`domain/storage-path.ts`, and `domain/file.types.ts`:

- Exactly two private buckets exist: `receipts`, `documents` (enforced at
  the TypeScript level by `FileStorageBucket`, and at the RLS level by
  `supabase/migrations/20260827100005_private_storage_rls.sql`).
- Every object path is `{administrationId}/{uuid}{extension?}` — the
  administration id prefix is load-bearing for RLS (`(storage.foldername
  (name))[1]`), never derived from user input.
- The app always goes through the Storage **HTTP REST API**
  (`supabaseClient.storage.from(bucket).upload/download/remove()`), never
  raw S3 protocol, even though the local stack's S3-compatible endpoint
  exists. This backup pipeline mirrors that same real access pattern — it
  uses the same REST endpoints (`storage-client.mjs`), just with the
  `service_role` key instead of a user session, because listing/downloading
  every tenant's objects for a backup is unavoidably cross-tenant.

**A real, documented credential limitation, not an oversight**: unlike
`backup_reader` (Postgres, INC-BKP-001), self-hosted Supabase Storage has no
built-in read-only, cross-tenant role. The only two JWT roles are `anon`
(RLS-scoped, useless for a backup) and `service_role` (bypasses
`storage.objects` RLS for both reads **and writes** — there is no privilege
barrier stopping this credential from also deleting objects, only this
pipeline's own discipline of never calling a destructive endpoint). This is
materially weaker than `backup_reader`'s hard, grant-level guarantee, and is
the single most important residual risk of this increment (see §8) and a
concrete requirement for the R2 migration (§9, where this *is* fixable).

## 2. Pipeline design (steps 2–7)

`scripts/backup/storage/`:
- `storage-client.mjs` — thin Storage REST API wrapper (recursive list,
  download-or-null-on-404).
- `pack.mjs` — packs a directory into one buffer and back. **Not tar.**
  `tar` (the Git-Bash-provided binary) was tried first and failed: Node
  spawned directly (no shell) passes Windows-native paths like
  `C:\Users\...`, and GNU tar misparses the `C:` prefix as a remote
  `host:path` spec (`tar: Cannot connect to C: resolve failed`) — this
  specific failure is real and was reproduced exactly by independent
  review. **Correction after that review**: a narrower fix exists too —
  building a POSIX-style path literal (`/c/Users/...`) in this script
  before invoking `tar` avoids the error in this same environment, so "no
  simpler mitigation was possible" (the original framing here) overstated
  the case. That narrower fix is itself fragile (OS-specific branching,
  and depends on this exact Git-Bash/MSYS `tar` understanding `/c/...`),
  so a dependency-free, platform-independent format remains the more
  robust choice — but as a deliberate design preference, not the only
  option available. This increment uses a ~40-line format instead: a
  4-byte index length, a JSON index of `{path, size}` (POSIX-style paths
  always, regardless of host OS), then concatenated file bytes. Only this
  script family ever
  reads or writes it, so tar-compatibility was never actually required.
- `export-storage-snapshot.mjs` — the pipeline: list both buckets
  recursively → download each object into an isolated staging directory
  (`os.tmpdir()`-based, deleted at the end whether the run succeeds or
  fails) → build the full manifest → pack the staging directory into one
  buffer → pipe that buffer through `age`'s **stdin/stdout directly** (no
  intermediate plaintext file ever touches disk — stronger than writing a
  plaintext pack file then encrypting it) with `-r <recipient1> -r
  <recipient2>` → write the resulting ciphertext as
  `<run_id>.snapshot.age` → write a small, non-sensitive summary manifest
  alongside it.
- `restore-storage-snapshot.mjs` — the inverse, with 3 independently-failing
  verification layers (archive checksum → decryption → per-object checksum
  after extraction). See §5.
- `test-storage-snapshot.mjs` — the automated test suite (§6/§7).

**Collision policy** (step 4): the run id is
`<ISO-8601-compact-timestamp>-<6 hex chars>` (e.g.
`20261013T150935Z-e98c0f`). Before writing anything, the exporter checks
whether `<run_id>.snapshot.age` or its summary already exist at the output
location and throws `SnapshotCollisionError` rather than overwriting —
verified by an automated test that creates a snapshot, captures its exact
bytes, forces a second run with the *same* run id, confirms it throws, and
re-reads the file afterward to confirm it is byte-for-byte unchanged.

## 3. Encryption — two independent recipients (step 6)

Generated two throwaway age identities for testing
(`age1...`/`age1...` public keys, private keys discarded with the test
scratch directory, never committed). The exporter requires `recipients.
length >= 2` and refuses to run otherwise. Validated that **both**
recipients independently decrypt the exact same archive — not just that the
encryption command accepted two `-r` flags:

```
restore with identity 1 -> restoreStatus: "VERIFIED" (4/4 objects MATCH)
restore with identity 2 -> restoreStatus: "VERIFIED" (4/4 objects MATCH)
```

Recovered bytes were then diffed against the original uploaded fixtures
(including a 2048-byte pseudo-binary file, not just text) — byte-for-byte
identical in both cases (step 9).

## 4. Manifest design (step 7)

Two manifests, deliberately split by sensitivity:

- **`manifest.json`** (inside the encrypted archive only, never persisted
  in plaintext) — the real inventory: every object's bucket, path, size,
  mime type, storage `eTag`, storage `updated_at`, this pipeline's own
  computed sha256, and a per-object `status` (`DOWNLOADED`/`MISSING`), plus
  `completeness` (`COMPLETE`/`PARTIAL`) and aggregate counts.
- **`<run_id>.manifest-summary.json`** (plaintext, alongside the archive) —
  the "manifiesto de ejemplo sin datos sensibles" deliverable. Contains run
  id, timestamp, bucket list, object/byte counts, completeness, the
  **archive's** sha256 (for pre-decryption integrity checking), and
  recipient count — deliberately **no individual paths, administration ids,
  or per-object checksums**. A real one, produced by an actual run against
  real local test data, is committed at
  `docs/ops/examples/storage-snapshot-manifest-summary.example.json`.

## 5. Integrity verification & recovery (step 8)

Three independently-failing layers, each reported distinctly rather than
merged into one generic "restore failed":

1. **Archive-level**: recompute the ciphertext's sha256 and compare against
   the summary manifest's `archiveSha256` — catches corruption of the
   encrypted file itself, before any decryption attempt.
2. **Decryption**: `age -d -i <identity>` — catches a wrong/missing
   identity or ciphertext that doesn't decrypt cleanly.
3. **Object-level**: after extraction, recompute sha256 of every extracted
   file and compare against the inner manifest's recorded value, plus a
   check for files present in the archive but *not* listed in the manifest
   (`unexpectedFiles`) — catches corruption introduced during/after
   extraction and any divergence between what the manifest claims and what
   was actually packed.

## 6. Real recovered-object validation (step 9)

Picked a real uploaded test object (a 2048-byte file with
`openssl rand`-generated content, uploaded as `image/jpeg`), ran it through
the full export → restore cycle, and confirmed:
- `diff` between the restored file and the original upload fixture: no
  differences.
- Restored manifest entry's `sizeBytes`/`mimeType` match what was recorded
  at upload time (2048 bytes, `image/jpeg`).
- Restored object's recomputed sha256 matches the manifest's recorded
  value exactly (`result: "MATCH"`).

## 7. Negative tests (step 10) — all passing, via `test-storage-snapshot.mjs`

Run against the live local stack (not mocked, except the one pagination
test noted below, which deliberately mocks `fetch` rather than uploading
1000+ real objects):

```
PASS  export -> restore -> full integrity verification (happy path)
PASS  regression (HIGH): a missing summary manifest is reported as SKIPPED, not silently indistinguishable from VERIFIED
PASS  regression (HIGH): Storage list pagination does not silently truncate at 1000 objects
PASS  a second run never touches or alters the first snapshot (acceptance criterion)
PASS  negative: collision - re-running with an existing run id is refused, not overwritten
PASS  negative: missing object - the full export pipeline marks a vanished object PARTIAL, not silently dropped
PASS  negative: corruption - a tampered archive is caught by checksum before decryption
PASS  negative: decryption failure - the wrong identity is rejected, not silently given garbage
PASS  negative: zip-slip - a malicious archive entry path cannot write outside outputDir
PASS  negative: encryption failure - a malformed recipient aborts cleanly, no plaintext or partial artifact left

10/10 passed
```

**Regression coverage for every reviewer finding, confirmed explicitly, not
assumed**: the BLOCKER (zip-slip) has its own dedicated test built from a
hand-crafted malicious archive encrypted with a real recipient key; the two
HIGH findings (pagination, silent checksum-layer skip) each have their own
dedicated test added specifically for this; the MEDIUM (TOCTOU collision)
is exercised by the existing collision test, which now runs through the
actual `{ flag: 'wx' }` write path.

Notes on how each was made deterministic rather than relying on timing or
luck:
- **Missing object**: rather than racing a real delete against a real list
  call (flaky by nature), `runExport` accepts an injectable `client`
  (added specifically for this test) wrapping the real Storage client but
  forcing exactly one *known-real* object's download to return `null`, as
  if it had just vanished. Confirmed the resulting snapshot is `PARTIAL`,
  the manifest records that specific object as `MISSING`, and restore
  correctly reports it as `SKIPPED_MISSING_AT_BACKUP_TIME` rather than a
  false integrity failure.
- **Corruption**: flips a single byte in the middle of a real, previously
  valid archive, pairs it with the real (unmodified) summary manifest, and
  confirms the archive-checksum layer (§5.1) throws before decryption is
  even attempted.
- **Collision**: see §2.
- **Encryption failure**: passes one valid and one syntactically invalid
  age recipient string; confirms `age` itself rejects it, the pipeline
  surfaces `EncryptionFailedError`, and — critically — no `.snapshot.age`
  file is left on disk for that run id afterward (no partial/corrupt
  artifact).
- Also added a 5th negative case beyond the required 4: **decryption with
  an identity that was never a recipient** of that snapshot is rejected
  with `DecryptionFailedError`, not silently producing garbage output.

This test suite is intentionally **not** part of `pnpm test` — it needs a
live local Supabase stack and the `age` CLI on `PATH`, neither of which the
main Vitest environment has or should be made to depend on (same reasoning
as the pre-existing `scripts/e2e-local-seed.mjs`, which is also excluded
from the default test run). Run manually per the usage comment at the top
of `test-storage-snapshot.mjs`.

## 8. Residual risks

1. **`service_role` is the only viable Storage credential for this backup
   pipeline, and it can write/delete, not just read** (§1). Nothing in this
   increment's own code ever calls a destructive Storage endpoint, but
   that is a property of this script, not of the credential itself — a bug
   here has a larger blast radius than `backup_reader`'s Postgres-side
   grant-level guarantee. Mitigations available today: run the export job
   under a short-lived key if/when Supabase Storage supports scoping one
   (not currently available in the self-hosted/local stack); keep this
   script's own code minimal and reviewed. The real fix is only available
   after migrating to R2 (§9).
2. **Local-only validation.** Same Storage/GoTrue images as the remote
   project, strong evidence, but the identical pipeline has not run against
   the real remote project's Storage — requires separate human approval.
3. **This increment's test fixtures are synthetic** (placeholder PDF text,
   random bytes labeled as a JPEG) — sufficient to validate the mechanism
   (bytes + metadata round-trip exactly), but not a real contract/receipt
   file. Not expected to matter for this pipeline (it treats all objects as
   opaque bytes, never parses content), but named for completeness.
4. **No GitHub Actions workflow, no R2, no scheduled run yet** — explicitly
   out of scope for this increment per its own restrictions.

## 9. Exact requirements for a future Cloudflare R2 integration

**Correction after independent review**: the original version of this
section described these requirements as "derived from the already-approved
Backup & DR architecture." Independent review searched this repo (`docs/`
and full git history, including `git log --all -S"Bucket Lock"` /
`-S"R2"`) and found no document or commit establishing that architecture —
it does not exist anywhere verifiable from this repository. Per
`CLAUDE.md §5` ("si algo del backend no puede verificarse desde este repo,
decirlo explícitamente en vez de asumirlo"), the items below are this
increment's **own recommendation**, reasoned from what this increment
itself validated plus publicly documented R2 behavior (R2 API tokens
cannot express "write without delete" as a distinct permission — Bucket
Locks, a retention policy independent of any credential, are the real
provider-native protection against deletion). They are not a cross-
reference to a prior approved design, because no such verifiable design
exists in this repository:

1. **Two separate, never-conflated credentials.** The *source* credential
   (Supabase `service_role`, read-and-technically-write, §8.1) must never
   be the same credential as the *destination* credential. The
   destination (R2 API token) should be scoped via R2's own token
   permissions to exactly the backup bucket, with write access for upload
   (R2 tokens don't support read-only + write-without-delete as separate
   grants — this is why a Bucket Lock, not token scoping, is the
   recommended protection against deletion here).
2. **An R2 Bucket Lock on the destination bucket**, with a retention window
   chosen to match whatever pruning schedule the eventual scheduled backup
   job uses (this increment does not itself define that schedule — no
   GitHub Actions workflow exists yet, see §8.4). Storage snapshots and any
   future Postgres snapshot pipeline should share one retention policy
   rather than defining two independently, to avoid exactly the kind of
   contradiction (a lock window outliving what the pruning logic assumes)
   that an inconsistency between the two would risk.
3. **Upload the pair, not just the archive**: `<run_id>.snapshot.age` and
   `<run_id>.manifest-summary.json` must land in R2 together, atomically
   enough that a reader never sees one without the other.
4. **Verify after upload, not just before.** This increment's local
   archive-checksum gate (§5.1) must be re-run against what R2 actually
   stored (comparing R2's reported ETag/checksum, or a fresh download, to
   the pre-upload sha256) before the run is considered durable — mirrors
   exactly the pattern already built here, just extended one hop further.
5. **The run-id naming convention carries over unchanged** — R2 object keys
   should use the same `<run_id>.snapshot.age` scheme, which already
   guarantees collision-freedom locally and continues to under R2's
   flat-namespace model.
6. **Nothing unencrypted ever reaches R2.** This increment's design
   already guarantees that (encryption happens in-memory, piped directly
   into `age`, before any network call to a destination) — the R2 upload
   step is strictly "upload the already-encrypted bytes," never a place
   where plaintext could leak.
7. **Secrets**: the R2 API token, and the private half of each age
   recipient identity held by a human recovery party (never the CI
   pipeline itself), are GitHub Actions secrets only, consistent with
   INC-BKP-001/002's "no secrets in the repo" discipline — not introduced
   by this increment, since no CI workflow exists yet, but binding on
   whichever increment adds one.

## 9b. Reviewer findings and fixes

Independent review found 1 BLOCKER, 2 HIGH, 2 MEDIUM, and 2 LOW findings,
all against the actual code (reproduced live, including an executable
proof-of-concept for the BLOCKER). All are fixed in the code now described
above (not in a separate patch — the descriptions elsewhere in this
document already reflect the fixed behavior):

- **BLOCKER — zip-slip / path traversal in `pack.mjs`'s `unpackToDirectory`,
  confirmed with a working PoC that produced a false `"VERIFIED"`.** An
  archive entry's `path` (part of the *decrypted* content, never validated
  against anything external) could contain `../` segments and write outside
  `outputDir` — and the `unexpectedFiles` check only ever looked inside
  `outputDir/objects`, so it never caught the escape. The reviewer noted
  this is not purely theoretical: an `age` public key is not secret (age
  encrypts *for* a recipient but never authenticates the sender), and §8.1
  already documents that the source credential can write/delete, so a
  substituted malicious archive at the backup destination is a real,
  not hypothetical, threat model. **Fixed**: `unpackToDirectory` now
  resolves every entry path and refuses (`UnsafeArchiveEntryError`) any
  path that is absolute, drive-lettered, or resolves outside `outputDir`.
- **HIGH — `storage-client.mjs` never paginated the Storage list API**,
  fixed at exactly 1000 entries per folder with no error and no manifest
  signal — an administration with >1000 objects in one bucket would have
  silently reported `completeness: "COMPLETE"` while missing everything
  past the first page. **Fixed**: `listOne` now loops until a page comes
  back short of the page size.
- **HIGH — a missing/corrupt summary manifest silently skipped the
  archive-checksum verification layer** with no indication in the restore
  result, making a restore that ran 2 of 3 verification layers
  indistinguishable from one that ran all 3. **Fixed**: the result now
  carries an explicit `archiveChecksumLayer: "VERIFIED" | "SKIPPED_NO_SUMMARY"`.
- **MEDIUM — the collision guard was check-then-write (TOCTOU), not
  atomic** — a real risk mainly for the test suite's own
  `SNAPSHOT_RUN_ID` override path, not the production random-run-id path.
  **Fixed**: the final writes to both the archive and summary paths now use
  `{ flag: 'wx' }` (atomic exclusive create, fails if the path already
  exists), with the pre-flight `existsSync` check kept only as a fast-fail
  before the expensive download/encrypt work, never as the actual
  guarantee.
- **MEDIUM — §9 cited an "already-approved Backup & DR architecture" for
  R2 that the reviewer could not find anywhere in this repo or its git
  history.** **Fixed**: reworded to present those items as this increment's
  own recommendation, not a cross-reference to a prior verifiable decision
  — see the correction note now at the top of §9.
- **LOW — `downloadObject` didn't `encodeURIComponent` path segments.**
  Not exploitable today (`buildStoragePath` only ever generates
  `{uuid}/{uuid}{fixed-extension}`, confirmed by the reviewer by reading
  `storage-path.ts`), but this script shouldn't depend on that invariant
  holding forever without noticing. **Fixed**: segments are now encoded.
- **LOW — the `tar` justification overstated that no simpler mitigation
  existed.** **Fixed** — see the correction now inline in §2.

No finding was disputed; all were verified against the actual code (several
with an executable reproduction) before being accepted.

## 10. Files created/modified this phase

- `scripts/backup/storage/storage-client.mjs` — new.
- `scripts/backup/storage/pack.mjs` — new.
- `scripts/backup/storage/export-storage-snapshot.mjs` — new.
- `scripts/backup/storage/restore-storage-snapshot.mjs` — new.
- `scripts/backup/storage/test-storage-snapshot.mjs` — new (automated test
  suite, run manually, see §7).
- `docs/ops/examples/storage-snapshot-manifest-summary.example.json` — new,
  a real (non-sensitive) manifest from an actual local test run.
- `docs/ops/storage-backup-validation-findings.md` — this document.

No application TypeScript touched, no migration touched or added. `pnpm
typecheck`, `pnpm lint`, and `pnpm test -- --run` all pass unchanged
(1009/1009) — none of these new `.mjs` scripts are reachable from the main
app or its lint/type graph. No remote operation of any kind was performed;
no Cloudflare account, bucket, or credential was created; no real recovery
private key was used; nothing was pushed or merged.

**Tooling notes for whoever runs this next**: `age`/`age-keygen` are not
installed by default on this Windows dev machine — they were installed via
`winget install FiloSottile.age` for this investigation (a system-level
tool install, not a repo dependency; flagged here for transparency since it
modifies the host, not just the repo). A production pipeline running in a
GitHub Actions Ubuntu runner would install `age` via its own setup step
(e.g. `apt-get install age` or a pinned release download), not winget.
