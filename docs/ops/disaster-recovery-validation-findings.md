# Disaster recovery validation (INC-BKP-005)

Status: full local recovery validated end-to-end, with real evidence at
every step — not simulated, not mocked except for the R2 destination
itself (no real Cloudflare account exists, per restriction). Nothing here
touched the remote Supabase project, created real infrastructure, or used
a real recovery key. No commit, no push.

## 1. State of INC-BKP-001 through INC-BKP-004 (step 1)

Reviewed, not re-implemented or re-reviewed:

- **INC-BKP-001**: `backup_reader` role (`supabase/migrations/20261013120000_create_backup_reader_role.sql`)
  — `LOGIN BYPASSRLS`, `pg_read_all_data`, no write grant. Still unapplied
  to remote.
- **INC-BKP-002**: `scripts/backup/export-postgres-data.sh` — unmodified,
  still the one PostgreSQL export mechanism in use.
- **INC-BKP-003**: `scripts/backup/storage/*.mjs` — unmodified in this
  increment except for the shared-helper extraction already done in
  INC-BKP-004 (not repeated here).
- **INC-BKP-004**: orchestrator, S3/R2 client, healthcheck client,
  GitHub Actions workflow (not committed). **One real defect found and
  fixed in this increment** (§3) — the orchestrator never uploaded the
  summary manifests to the destination, only the encrypted archives. This
  was not caught by INC-BKP-004's own mocked test suite, because that
  suite never attempted an actual recovery round-trip against the
  destination — it only checked what `run-backup.mjs` itself reported,
  not what was actually readable back out. This increment's own first
  genuine end-to-end attempt (real backup → real selection check → real
  recovery) is what surfaced it.

## 2. A real local backup, via the real orchestrator (step 2)

Ran `node scripts/backup/run-backup.mjs` as an actual CLI process (not a
function call with test doubles) against:
- Real local Postgres via `backup_reader` (Docker escape hatch, same as
  INC-BKP-004).
- Real local Supabase Storage, with 2 real uploaded documents (a receipt
  and a signed contract, one plain text and one 4096-byte pseudo-binary
  file) tied to a real seeded administration
  (`726c5e5a-59d1-4f2c-88d2-69f8fbab1caf`, from `pnpm e2e:local:seed`),
  with matching `public.files` rows (not just raw `storage.objects` —
  the actual domain-model shape the app itself reads).
- A **standalone, persistent** mock R2 server process (`mock-r2-server.mjs`
  launched as its own long-running process, not an in-test ephemeral
  instance) — this matters: the backup run and the later recovery run are
  genuinely separate processes talking over real HTTP to a real listening
  socket, decoupled the same way a real backup run and a real recovery run
  would be against actual R2, rather than sharing in-process JS state.

Result: `completeness: "COMPLETE"` for both legs, run id
`20261013T191851Z-cd5f58` (the run used for the rest of this document —
a first attempt under run id `20261013T191605Z-9e572e` surfaced the
missing-summary-upload defect below and was superseded after the fix).

## 3. Real defect found and fixed: summary manifests were never uploaded

`run-backup.mjs`'s `uploadAndVerify()` only ever uploaded the encrypted
archive to the destination — the non-sensitive summary manifest (the
thing `shared/select-snapshot.mjs`, step 8, depends on to decide whether a
run is even eligible for restore) was written locally and then deleted
with the rest of the staging directory, never reaching R2 at all.

Confirmed concretely: the first real recovery attempt against run id
`20261013T191605Z-9e572e` failed immediately with `"<runId>.postgres-
manifest-summary.json" not found at destination` for both legs.

**Fixed**: `uploadAndVerify()` now uploads and independently verifies
(download-and-compare, same pattern as the archive) both the archive and
its summary. `scripts/backup/test-run-backup.mjs`'s happy-path assertion
was updated accordingly (now expects 4 objects per run — 2 archives + 2
summaries — not 2), and the fix was proven by re-running the real backup
(new run id `20261013T191851Z-cd5f58`) and confirming the subsequent real
recovery succeeded end-to-end (§5–§7).

## 4. Selection guard: incomplete/corrupted snapshots cannot be restored (step 8)

New: `scripts/backup/shared/select-snapshot.mjs`. Before any decryption
is attempted, `selectSnapshotForRestore()` downloads only the two small
summary manifests (never the potentially-large archives, and never
requires an identity/private key to evaluate) and checks three
independent things per leg: the summary exists, its own `completeness`
field is `"COMPLETE"`, and the archive's actual bytes at the destination
match the summary's recorded `archiveSha256`. Any failure throws
`SnapshotNotEligibleError` with the specific reasons — never a silent
"maybe restorable."

`scripts/backup/test-select-snapshot.mjs`, run against the real mock R2
server (not a fresh in-test instance — the same persistent one used for
the real backup/recovery above):

```
PASS  a real, COMPLETE, uncorrupted snapshot is eligible for restore
PASS  negative: a run id that never uploaded anything is rejected, not silently treated as empty-but-fine
PASS  negative: a summary reporting PARTIAL completeness is rejected
PASS  negative: a tampered/corrupted archive (checksum mismatch) is rejected before any decryption attempt
PASS  negative: a summary present but its referenced archive file missing is rejected

5/5 passed
```

The "corrupted archive" and "PARTIAL completeness" cases were constructed
by `putObject`-ing deliberately bad summaries/archives directly to the
same live server the real backup used — not separate mocks of the
rejection logic.

## 5. Recovery: download, select, decrypt (step 3)

New: `scripts/backup/recover-from-destination.mjs`. Given only a run id,
an identity file, and R2 credentials — no local staging artifacts assumed
to exist, matching the real constraint that `run-backup.mjs` deletes its
staging directory at the end of every run:

1. Calls `selectSnapshotForRestore` (§4) — refuses an ineligible run id
   before doing anything else.
2. Downloads both archives.
3. Decrypts each with **one** of the two age identities (simulating a real
   disaster where only one human-held key is available — never both).
4. For PostgreSQL: the decrypted bytes are the plaintext SQL dump,
   written to disk for the caller to feed into `psql` — this script does
   not execute it itself, keeping "recover bytes" and "mutate a target
   database" as separate, explicit steps (see the runbook).
5. For Storage: unpacked via the same `pack.mjs` format
   `storage/restore-storage-snapshot.mjs` already uses — `objects/<bucket>/
   <path>` plus `manifest.json`, not a new layout invented for this script.

Ran for real against run id `20261013T191851Z-cd5f58` with identity 1
only. Both recovered documents were then byte-for-byte diffed against the
originally-uploaded fixtures — identical, including the 4096-byte
pseudo-binary one.

## 6. Restoring into a genuinely empty instance (step 4–5)

**A second real finding, surfaced by trying to simulate total loss
honestly rather than assuming `supabase db reset` was sufficient**:
`supabase db reset` only resets the **PostgreSQL** database — it does
**not** clear Supabase Storage's backing file volume. Confirmed directly:
after `db reset`, a `GET` on the previously-uploaded receipt's path
returned **200 with the original, pre-"disaster" file content** — the
bytes had simply never been deleted. A DR test that used `db reset` alone
would have silently "passed" the Storage leg without ever actually
exercising the Storage restore path at all.

**Fix for this validation (not a code change — an operational
correction)**: used `supabase stop --no-backup` (deletes all data
volumes) followed by `supabase start` (rebuilds from migrations fresh)
to get a genuinely empty instance — confirmed `select count(*) from
storage.objects` = 0, `select count(*) from public.administrations` = 0,
and the previously-uploaded file now returning a not-found response,
before attempting any restore.

Restore order, and the one non-obvious operational detail this surfaced:

1. **PostgreSQL dump restored first** (`psql < recovered.postgres.sql`) —
   clean, no errors. This also re-creates the `storage.objects`
   **metadata** rows (the dump's `--schema "*"` scope includes
   `storage.objects`; only `storage.buckets`/`storage.migrations` are
   excluded, per INC-BKP-002's own design).
2. **Storage leg re-upload attempted with a plain `POST`**: failed with
   `409 KeyAlreadyExists` for both files. Root cause: step 1 already
   recreated the `storage.objects` metadata row at that exact path, and
   Supabase Storage's plain upload endpoint refuses to overwrite existing
   metadata.
3. **Fix**: re-uploading with the `x-upsert: true` header (the same flag
   the Storage SDK's `upload(..., { upsert: true })` sends) succeeds —
   it updates the existing metadata row's content instead of insisting on
   a fresh create. This is now a named, required step in the runbook
   (§10), not something to rediscover under pressure during a real
   incident: **restoring both legs of a Supabase project always requires
   `x-upsert: true` on the Storage leg, because the PostgreSQL leg's own
   restore order unavoidably recreates the metadata first.**

Confirmed after the upsert re-upload: both files download successfully,
byte-for-byte identical to the originals, with the **same** `storage.
objects.id` as before (an upsert, not a new row).

## 7. Integrity, auth, financial data, document access (step 6)

All against the fully restored instance (fresh from `stop --no-backup` +
`start`, both legs restored):

- **Referential integrity**: new, reusable
  `scripts/backup/verify-referential-integrity.sql` (a real script now,
  not a one-off typed into `psql` during INC-BKP-002 and then lost to
  shell history) — walks every FK constraint in `pg_constraint`
  generically. **140 constraints checked, 0 with orphans.**
- **Authentication**: a real password login
  (`POST /auth/v1/token?grant_type=password`) against the restored
  `auth.users` row succeeded, returning a valid access token — the
  restored bcrypt hash is functional, not merely present.
- **Financial data**: `public.payments`/`public.charges` rows restored
  with their real COP amounts intact (1,500,000 / 1,200,000), correct
  status (`CONFIRMED`), not placeholders.
- **Document access**: both `public.files` rows (the real
  `FileRepository` domain contract — `storage_bucket`/`storage_path`, not
  raw `storage.objects` alone) correctly reference `storage.objects` rows
  that exist and whose actual bytes download correctly and match the
  originals.

## 8. Authenticated functional tests against the restored environment (step 7)

Ran the existing authenticated Playwright suite
(`pnpm test:e2e:local`) — real login via the actual login form
(`auth.setup.ts`), then real navigation through dashboard, rentals,
payments, contracts, charges, terms, and the pending-payments view, in
both light/dark and desktop/mobile:

```
37 passed (1.1m)
```

This is real functional evidence, not just raw SQL/HTTP checks: the
application itself, driven through its real UI against the restored
database and the restored auth user, renders the restored financial data
correctly.

## 9. Retention policy: 7 daily + 4 weekly, with Bucket Lock interaction

Per the correction already made in INC-BKP-003/004's own review history,
this is this increment's own design, not a reference to any prior
"approved" decision (none exists verifiably in this repo):

- **Tiers**: 7 daily snapshots (rolling, oldest pruned on the 8th) + 4
  weekly snapshots (one retained per calendar week, oldest pruned on the
  5th), applied **identically to both legs** (PostgreSQL and Storage share
  one retention schedule, keyed by the same run id prefix — never two
  independent policies that could silently drift apart).
- **Weekly selection rule**: the first successful (`completeness:
  "COMPLETE"` for both legs) run of each ISO week is promoted to that
  week's weekly snapshot; a week with no COMPLETE run has no weekly
  snapshot for that week — pruning logic must never promote a PARTIAL/
  FAILED run just because it's the only one available that week.
- **Pruning gate**: a run is only eligible for pruning (deletion) if a
  newer COMPLETE run already exists to replace it in its tier. A
  PARTIAL/FAILED run is never counted as satisfying this (so a string of
  failures doesn't silently erode the actual safety margin).
- **R2 Bucket Lock window**: set to **8 days** — one day longer than the
  daily tier's own 7-day rolling window, so a lock never expires on the
  same day a prune would otherwise be attempted, avoiding exactly the kind
  of off-by-one race a shorter window would risk. The weekly tier's
  snapshots are additionally protected by **being outside the daily
  pruning logic's reach entirely** (different retention tag/prefix), not
  by a separate, longer lock — one lock duration, applied uniformly, is
  simpler to reason about than two.
- **What this does NOT yet define**: the actual pruning job/schedule
  (no scheduled workflow exists — INC-BKP-004's cron trigger is commented
  out) and the exact R2 lifecycle-rule/Bucket Lock API calls (no R2
  account exists to configure). This section is the policy; wiring it to
  real R2 configuration is explicitly deferred to the activation runbook's
  own human checklist (§10 of
  `docs/ops/activation-runbook.md`), since that requires a real account.

## 10. Reviewer findings and fixes

Independent review found **0 BLOCKER, 0 HIGH, 1 MEDIUM, 1 LOW** — both
real, both fixed, both with a new regression test. Review independently
re-ran (not just re-read) the referential-integrity check, the selection
suite, and the orchestrator suite against the live stack/mock server, and
separately confirmed via the read-only Supabase MCP (`list_migrations`)
that `backup_reader`'s migration is still absent from the remote project.

- **MEDIUM — `shared/select-snapshot.mjs`: an unclear error message when a
  summary parses to a JS-falsy, non-object value** (`null`, `0`, `false`,
  `""`). `fetchSummary`'s success path returned `{ summary: parsed }`
  without validating `parsed` was actually an object; `checkLegEligibility`'s
  `if (!summary)` branch then treated any falsy value the same as
  "not found," reusing a `reason` field that was never set for that case.
  Reviewer reproduced it directly: a summary file containing literal
  `null` produced `SnapshotNotEligibleError`'s message reading
  `"postgres: undefined; storage: undefined"` — still fail-closed (never
  eligible), but useless to an operator diagnosing a real incident, which
  directly contradicts this module's own documented intent ("never a
  silent 'maybe restorable'" implies the *reason* must be real too).
  **Fixed**: `fetchSummary` now explicitly checks `typeof parsed !==
  'object' || parsed === null` and returns a descriptive reason
  (`"... parsed as valid JSON but is not an object (got ...)"`). New
  regression test added to `test-select-snapshot.mjs` (now 6/6), asserting
  the message is never `"undefined"` and names the actual problem.
- **LOW — `recover-from-destination.mjs`: no cleanup if `unpackToDirectory`
  fails partway through**. If decryption succeeds but the Storage leg's
  pack index is corrupted (or a later entry trips the zip-slip guard),
  the PostgreSQL dump (and possibly some Storage objects) would already
  be written to `outputDir` with no indication the overall recovery
  failed — a half-written directory indistinguishable from a complete
  one to anyone just looking at it. Reviewer judged this low-impact (a
  human-operated, one-shot script; not a security issue, since the
  zip-slip guard itself still holds per-entry) but real. **Fixed**: the
  write phase is now wrapped so any failure renames `outputDir` to
  `<outputDir>.partial-<timestamp>` (never deletes it — partial bytes can
  help diagnose the failure) before the original error propagates. New
  `scripts/backup/test-recover-from-destination.mjs` (new file, 2/2)
  covers both the happy path and this exact regression (a corrupted pack
  index, confirming the postgres dump survives under the renamed
  directory).

No finding was disputed. Review's one explicit, honest limitation: it did
not reproduce the full "total loss → restore → 37 E2E" cycle itself,
judging that deliberately destroying the active local stack
(`supabase stop --no-backup`) without being asked would be a destructive
action out of scope for a read-only review — it instead independently
reproduced every piece that could be isolated without that
(`verify-referential-integrity.sql` against data already present,
`select-snapshot`/`run-backup` against the mock server, both matching this
document's own reported results).

## 11. Files created/modified this phase

- `scripts/backup/shared/select-snapshot.mjs` — new; fixed post-review (§10).
- `scripts/backup/recover-from-destination.mjs` — new; fixed post-review (§10).
- `scripts/backup/test-select-snapshot.mjs` — new; regression test added post-review (now 6/6).
- `scripts/backup/test-recover-from-destination.mjs` — new, added post-review (2/2).
- `scripts/backup/verify-referential-integrity.sql` — new (promoted from
  INC-BKP-002's ad-hoc shell history into a real, reusable script).
- `scripts/backup/run-backup.mjs` — fixed (§3): summary manifests now
  uploaded and verified, not just archives.
- `scripts/backup/test-run-backup.mjs` — updated assertion (4 objects per
  run, not 2) to match the fix.
- `docs/ops/disaster-recovery-validation-findings.md` — this document.
- `docs/ops/activation-runbook.md` — new (separate document, see below).

No application TypeScript touched. `pnpm typecheck`/`lint` unaffected
(confirmed — nothing in this phase's file set is reachable from the main
app's type/lint graph). `pnpm test` (the main Vitest suite) not re-run in
this phase specifically, since nothing in `src/` changed — already
confirmed clean in INC-BKP-004's own final validation pass.
