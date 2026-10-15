# `backup_reader` role — viability findings (INC-BKP-001, Phase 1)

Status: investigation complete, verified **locally only** (`supabase start` / `supabase db
reset` against the local stack). This role has **not** been created on the remote Supabase
project. The migration that would create it (`supabase/migrations/20261013120000_create_backup_reader_role.sql`)
is authored and versioned, but applying it to the real remote project requires a separate,
explicit human approval (per `ARCHITECTURE.md` §0.1 / `CLAUDE.md` §5) — not granted by this
document.

## What was tested, and the result

All tests below ran against the local Postgres container (`supabase_db_Habitex-v2`) after
`supabase db reset` applied every migration including the new one, followed by
`scripts/e2e-local-seed.mjs` to populate representative data (2 rental relationships, 2
payments, 2 charges, 1 administration, 3 people, 1 `auth.users` row).

| # | Test | Result |
|---|---|---|
| 1 | `backup_reader` reads full row counts across RLS-protected tables (`administrations`, `rental_relationships`, `payments`, `charges`, `people`), compared against the same counts read as `postgres` | **Identical counts in both cases** — confirms `BYPASSRLS` is working; the role does not silently see a filtered/empty subset. |
| 2 | `backup_reader` attempts `INSERT`/`UPDATE`/`DELETE` | **All three rejected** (`cannot execute ... in a read-only transaction`). |
| 3 | Raw `pg_dump` against the local DB using `backup_reader`'s connection string (`--no-owner --no-privileges --data-only`) | **Succeeded**, produced a 1171-line, non-empty dump with real data rows (verified real payment/charge rows with actual amounts/dates present, not placeholders). |
| 4 | `grep` the resulting dump for `COPY auth.` statements | **26 `auth.*` tables captured**, including `auth.users`, `auth.identities`, `auth.sessions`, `auth.refresh_tokens`, `auth.mfa_factors`, `auth.one_time_tokens` — this resolves the "NO VERIFICADO" item from the architecture design regarding exactly which Auth tables a dump covers. |
| 5 | The actual `supabase db dump` CLI (the tool the architecture design proposed using) against `backup_reader` | **Fails**, both in `--data-only` and schema-only mode: `pg_dump: error: query failed: ERROR: permission denied to set role "postgres"`. |
| 6 | Root cause of #5, via `supabase db dump --dry-run` | The Supabase CLI unconditionally passes `--role "postgres"` to the underlying `pg_dump` invocation — this is hardcoded, not exposed as a configurable flag (confirmed via `supabase db dump --help`: no override exists). **`supabase db dump` cannot be used with any role other than `postgres` itself, ever**, regardless of that role's own grants. |
| 7 | Raw `pg_dump --schema-only`, using the exact `--exclude-schema`/`--exclude-table` list the CLI's own `--dry-run` revealed it uses internally, with `backup_reader` and no `--role` flag | **Succeeded, zero errors** — 26 `auth.*` tables, 9 `storage.*` tables, 40 `public.*` tables, 9320-line schema dump. |

## The one real limitation this phase found (task's own instruction §6)

**`supabase db dump` is structurally incompatible with any restricted, non-`postgres` role** —
not a configuration gap, a hardcoded `--role "postgres"` in the CLI's own generated `pg_dump`
invocation. Granting `backup_reader` membership in `postgres` to work around this would defeat
the entire point of a minimal-privilege role (it would let `backup_reader` assume full
superuser-equivalent access via `SET ROLE postgres` at will).

**Resolution — CORRECTED after independent review, originally overstated as "verified
working."** The review independently ran `supabase db dump --dry-run` for **both** modes
(data-only and schema-only, pinned to the exact CLI version this repo's own `package.json`
fixes) and found the raw-`pg_dump` replacement proposed in the original version of this
section was **not actually equivalent** to what the official tool produces:

1. The real **data** dump uses `--column-inserts --rows-per-insert 100000` (plain `INSERT`
   statements) — not `COPY` format, which is what raw `pg_dump` produces by default and what
   test #3/#4 above actually used. These are different, not interchangeable, dump formats.
2. The real data dump wraps the output with `SET session_replication_role = replica;` first
   (disables triggers so rows can restore regardless of FK order) and `RESET ALL;` last —
   neither was in the original proposed replacement.
3. Both modes pipe through `sed -E 's/^\\(un)?restrict .*$/-- &/'` to comment out
   `\restrict`/`\unrestrict` meta-commands (new in `pg_dump` 18+, which break older `psql`
   clients) — not replicated.
4. **The schema-only exclude-list is different from the data-only one, and this document
   originally conflated them**: the real schema-only mode's `--exclude-schema` list includes
   `auth` and `storage` as fully excluded schemas — it does **not** dump their schema
   definitions at all (those schemas are platform-provisioned on any Supabase project; the CLI
   correctly treats re-creating them as out of scope). Test #7 above used the *data-only* list
   for a *schema-only* run and still captured `auth`/`storage` tables — which is real and
   reproducible (raw `pg_dump`, unlike the CLI, has no reason to skip them with that list), but
   it does **not** mean the proposed single command is "the same as what the CLI does," as
   originally claimed. It means raw `pg_dump` can do *more* than the CLI's schema-only mode by
   default, not the same thing.
5. The real schema-only mode applies roughly 20 additional `sed` substitutions for restore
   idempotency (`CREATE TABLE/VIEW/FUNCTION/TRIGGER IF NOT EXISTS` / `OR REPLACE`, stripping
   `GRANT`/`REVOKE` on internal schemas, extension-specific handling for `pgsodium`/`pgmq`/
   `pg_tle`, removing `CREATE PUBLICATION supabase_realtime`, etc.) — none of this was captured
   or flagged as needing manual replication.

**Corrected conclusion**: the finding that `supabase db dump` is incompatible with any
restricted role (confirmed independently twice now, including by the reviewer re-running
`--dry-run` directly) stands and is solid. But **"use raw `pg_dump` with this one exclude-list"
is not yet a validated replacement** — it is an open problem requiring a dedicated follow-up
pass that diffs the full `--dry-run` output of both modes against whatever CLI version the
real pipeline will pin, and makes an explicit, deliberate decision for each of the 5 items
above (replicate it, or consciously omit it and accept the consequence) before any pipeline
code is written around this. This is correctly scoped **out of this phase** — flagged here as
the concrete next investigation, not solved by this increment.

**RESOLVED in INC-BKP-002** — see `docs/ops/postgres-export-validation-findings.md` for the
full follow-up: each of the 5 items above was given an explicit, deliberate decision (not a
blind copy), a genuine restore-blocking collision with migration-provisioned `storage.buckets`
rows was found and fixed, and the resulting export/restore cycle was validated end-to-end
(77-table exhaustive row-count parity, 140/140 FK constraints with zero orphans, a real
post-restore GoTrue login, and an isolated two-connection write-rejection test). The versioned
artifact is `scripts/backup/export-postgres-data.sh`.

## What this does NOT resolve

- **Roles (`roles.sql`-equivalent) still require a `postgres`-level connection** — `pg_dumpall
  --roles-only` (or an equivalent role-listing query) needs to read `pg_authid`, which is
  restricted to superuser/`postgres`-equivalent roles regardless of `pg_read_all_data`. This
  was already assessed as low-value for a Supabase-to-Supabase restore (standard roles are
  platform-provisioned on any new project) — this finding doesn't change that conclusion, it
  just confirms `backup_reader` specifically cannot produce that piece even if wanted.
- **This was tested against the local Supabase stack, not the remote project** — the local
  stack uses the same Postgres/GoTrue container images, so this is strong evidence, but the
  task's own restriction (no remote operations) means the identical test has not yet been run
  against the real remote project. That remains a pending verification for whenever a human
  approves applying the migration there.
- **The ephemeral local test password was set directly via `docker exec psql` against the local
  container only** (`local-test-only-ephemeral-7f3a9c`) — never written to any file, migration,
  or commit. A real deployment would set the real password out-of-band (Supabase
  dashboard/SQL editor), stored only as a GitHub Actions secret, exactly as the approved
  architecture design specifies.
- **One unexplained minor nuance, resolved by the independent reviewer via static analysis**:
  issuing `SET default_transaction_read_only = off;` within the same `backup_reader` session
  did not appear to change the subsequent statement's read-only rejection in this test (same
  error persisted) — most likely because `psql -c` with multiple semicolon-separated statements
  executes as one implicit transaction block whose read-only mode is fixed at transaction start.
  This left open whether the role is *also* rejected on write by privilege-denial alone,
  independent of the session guard. **Resolved**: the reviewer re-read the migration's full SQL
  and confirmed the only `GRANT` in the entire file is `grant pg_read_all_data to backup_reader`
  — a role Postgres documents as granting `SELECT`/`USAGE` only, with no write privilege and no
  `BYPASSRLS` of its own. No `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE` grant exists anywhere in the
  file, so the "no write privilege" property is proven by static inspection of the migration
  itself, independent of the ambiguous session-level test. A cleaner two-separate-connection
  test (confirming the privilege-denial error message specifically, not just inferring it)
  remains a reasonable follow-up but is not blocking.

## Files created/modified this phase

- `supabase/migrations/20261013120000_create_backup_reader_role.sql` — new, versioned, **not
  applied to remote**. No password in the file.
- `docs/ops/backup-reader-role-findings.md` — this document.

No other file touched. No TypeScript/application code changed (confirmed: `pnpm typecheck`,
`pnpm lint`, `pnpm test -- --run` all pass unchanged — 1009/1009 — and `pnpm build` succeeds,
none of which this migration could plausibly have affected, run anyway for discipline).
