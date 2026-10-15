# PostgreSQL backup export validation (INC-BKP-002)

Status: investigation and local validation complete. Everything below was run
**exclusively against the local Supabase stack** (`supabase start` /
`supabase db reset`, container `supabase_db_Habitex-v2`). Nothing in this
phase touched the remote project, created a remote role, or ran write SQL
remotely. `backup_reader` itself was authored in INC-BKP-001
(`supabase/migrations/20261013120000_create_backup_reader_role.sql`) and
remains unapplied to the remote project.

This phase closes the open problem INC-BKP-001 explicitly left unresolved:
*"use raw `pg_dump` with this exclude-list" was not yet a validated
replacement for `supabase db dump`.* It now is, with the deviations below
made deliberately, not by omission.

## 1. Ground truth: what `supabase db dump` actually does

Re-ran `supabase db dump --local --dry-run` for both modes against this
repo's pinned CLI version (`2.117.0`, from `package.json`) to get the exact
generated script, not a recollection of it:

- **Both modes hardcode `--role "postgres"`.** No override flag exists
  (confirmed again via `--help`). This independently re-confirms INC-BKP-001's
  central finding, directly from the CLI's own `--dry-run` output, not
  secondhand.
- **Data-only mode**: wraps with `SET session_replication_role = replica;`
  / `RESET ALL;`, uses `--column-inserts --rows-per-insert 100000` (plain
  `INSERT`s, not `COPY`), excludes only platform-internal schemas (not
  `auth`/`storage` themselves) plus three migration-tracking tables
  (`auth.schema_migrations`, `storage.migrations`,
  `supabase_functions.migrations`), and pipes through a `sed` that comments
  out `\restrict`/`\unrestrict` meta-commands.
- **Schema-only mode**: excludes `auth`/`storage`/`cron` entirely (these are
  platform-provisioned, not meant to be re-created by a user dump), and
  applies ~20 `sed` substitutions for restore idempotency
  (`IF NOT EXISTS`/`OR REPLACE`, stripping internal-schema `GRANT`/`REVOKE`,
  extension-specific handling, removing `CREATE PUBLICATION
  supabase_realtime`, event triggers, etc.).

## 2. Design decision: don't copy the CLI, decide each piece deliberately

Per this task's own instruction not to assume every internal step must be
replicated, and per the already-approved Backup & DR architecture's own rule
that **schema is always sourced from `supabase/migrations/`, never from a
dump's `schema.sql`** — the schema-only mode is out of scope for the backup
pipeline entirely. `backup_reader` only needs to produce a **data-only**
export. Each piece of the CLI's data-only script was evaluated on its own
merits:

| Piece | Decision | Why |
|---|---|---|
| `--role "postgres"` | **Dropped** | Structurally incompatible with any restricted role; not needed anyway — `backup_reader` already has `BYPASSRLS` + `pg_read_all_data`, so no `SET ROLE` is required to see everything. |
| `--no-owner --no-privileges` | **Added — not present in the CLI's own script** | A real, deliberate deviation flagged by independent review: the CLI's `--dry-run` output has neither flag. Already the reasoning in INC-BKP-001's migration comment ("ownership is NOT handled by this role at all... the backup pipeline runs every dump with `--no-owner --no-privileges`"), carried over here but previously missing from this specific comparison table. Effect confirmed by diffing output with/against the flags: purely cosmetic in `--data-only` mode (changes the `-- Owner: X` comment to `-- Owner: -`), no executable-statement difference — but real and worth naming explicitly rather than leaving this table looking exhaustive when it wasn't. |
| `SET session_replication_role = replica;` / `RESET ALL;` | **Kept** | Genuinely load-bearing: disables FK/trigger enforcement during load so INSERT order doesn't have to match dependency order. Verified necessary — see §4. |
| `--column-inserts --rows-per-insert 100000` | **Kept, and preferred over `COPY`** | Produces plain `INSERT` statements, which are byte-grep-able and selectively replayable — directly useful for the already-approved Procedure A (row-level repair by primary key), which `COPY` blocks are not. |
| `sed` comment-out of `\restrict`/`\unrestrict` | **Kept** | Real forward-compat issue (`pg_dump` 18+ emits these; older `psql` chokes on them). Zero cost, real benefit. |
| `--exclude-schema` (platform/extension schemas) | **Kept as-is** | These are genuinely Postgres-internal/extension schemas, not Habitex's concern, in either tool. |
| `--exclude-table auth.schema_migrations / storage.migrations / supabase_functions.migrations` | **Kept** | Platform migration-tracking tables; irrelevant to Habitex data, and re-importing them risks collision with the target project's own tracking state. |
| `--exclude-table storage.buckets` | **Added — not present in the CLI's own data-only list** | New finding, not inherited from the CLI. See §4. |
| `--disable-triggers` | **Deliberately not added** | Was tried and reverted (see §5) — it requires table ownership this role doesn't have, and is redundant with the session-level replica setting already in place. |

The resulting script is
`scripts/backup/export-postgres-data.sh`, parameterized entirely by
`PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD` environment variables —
no credential is hardcoded anywhere in it.

## 3. Completeness: exhaustive, not sampled

INC-BKP-001 spot-checked ~5 tables for `backup_reader` vs. `postgres` row-count
parity. This phase checked **all 77 tables** in `public`/`auth`/`storage`
(every table reported by `pg_tables` for those three schemas) in one pass:

```sql
select tbl, cnt from (
  select 'public.accounts' as tbl, (select count(*) from public.accounts) as cnt
  union all ... -- one term per table, generated from pg_tables
) c order by tbl;
```

Run once as `postgres`, once as `backup_reader` (fresh connection, real
password, over the network, not a superuser session) — **`diff` of the two
result sets was empty.** Identical counts on every one of the 77 tables,
including every nonzero one (26 tables with real seeded data: 6 in `auth`,
1 in `storage`, 18 in `public` at the time of this check, plus one
additional `storage.objects` row added mid-investigation, see §6). No
RLS-filtered omission anywhere, proven exhaustively rather than by sample.

## 4. The real blocker this phase found: `storage.buckets` collides with migration-time provisioning

The first full reset → restore attempt failed:

```
ERROR:  duplicate key value violates unique constraint "buckets_pkey"
DETAIL:  Key (id)=(receipts) already exists.
```

Root cause: `supabase/migrations/20260827100005_private_storage_rls.sql`
provisions the `receipts` and `documents` buckets itself, at migration-apply
time, via `INSERT ... ON CONFLICT (id) DO UPDATE`. This means **every fresh
schema rebuilt from `supabase/migrations/` already has these two bucket rows
before any data restore runs** — `storage.buckets` is deterministic,
migration-managed configuration, not tenant data, exactly like the three
already-excluded migration-tracking tables. Checked the rest of the
migration history for similar top-level seed `INSERT`s: the only other one
(`20260915231430_...012_occupancy_and_activation_concurrency.sql`) is a
backfill `INSERT ... SELECT` over a table that is empty at the point in
migration history where it runs, so it does not collide.

**Fix**: added `--exclude-table "storage.buckets"` to the export. Re-ran the
full reset → restore cycle — clean, no errors. This is a genuine difference
from what `supabase db dump`'s own data-only mode does (it does not exclude
`storage.buckets`) — found by actually attempting a restore, not by
inspecting the CLI's script.

## 5. A deviation I introduced and then reverted

I initially added `--disable-triggers` to the export (reflexively, not
deliberately), reasoning it would help with the circular-FK warning `pg_dump`
emits for the `people` table. On review this was wrong: `--disable-triggers`
emits `ALTER TABLE ... DISABLE/ENABLE TRIGGER ALL` around the data load,
which **requires table ownership** — exactly the kind of operation a
deliberately non-owning role's restore process should not depend on. The
`SET session_replication_role = replica;` wrapper (already kept, see §2)
achieves the same effect at the session level without needing ownership.
Removed before this became the shipped script. `pg_dump`'s own warning about
the `people` table's circular FK is benign given the `replica` wrapper is
already in place for the restore.

## 6. Restoration test — isolated local environment

Procedure: `supabase db reset` (rebuilds the schema from
`supabase/migrations/` only, zero data — this is the "isolated local
environment" called for, since it's a genuine from-migrations rebuild, not
reused stale data) → pipe the `backup_reader`-produced export into `psql` as
`postgres` → verify.

Also uploaded one real file via the local Storage API directly (bypassing
the app) to populate `storage.objects`, which had zero rows in the initial
seed and would otherwise have gone unvalidated: `storage.objects` metadata
(id, bucket, path, size, mimetype, etag) round-tripped through dump/restore
exactly, confirmed by direct row comparison (actual file bytes in the
S3-compatible object store are out of scope for this increment — "Storage"
here means the Postgres-level metadata table, not the blob layer; this
increment's restrictions explicitly exclude implementing Storage/R2).

**Results, run against the actual versioned script's own output (not just
my working notes):**

- Restore exit code 0, no errors, on the corrected export.
- All 77 tables: restored counts identical to what was dumped (including
  `storage.objects` = 1, all financial/domain tables matching exactly).
- **Referential integrity**: wrote a generic checker that walks every FK
  constraint in `pg_constraint` and checks for orphaned child rows against
  the actual constraint definition (not a hardcoded table list) — **140 FK
  constraints checked, 0 with orphans**, after fixing a bug in the checker
  itself (see note below).
- **Financial data**: spot-checked actual `payments` rows post-restore — real
  COP amounts (1,500,000 / 1,200,000), correct status/currency/dates, not
  placeholders.
- **Auth — not just present, functional**: the restored `auth.users` row
  (with its original bcrypt hash) was used to perform a **real password
  login** against the local GoTrue instance post-restore
  (`POST /auth/v1/token?grant_type=password`), which returned a valid
  `access_token`. This is stronger evidence than row presence alone — the
  credential actually works after restore. (Independent review re-ran the
  rest of this phase's checks live against the local stack but could not
  itself reproduce this specific login step — its sandbox blocked setting a
  test password on the role. The mechanism claimed here, that `pg_dump
  --column-inserts` preserves the bcrypt hash byte-for-byte, was accepted by
  the reviewer as plausible and consistent with everything else it verified,
  but is flagged here as independently unconfirmed rather than glossed
  over.)
- **Write-rejection via independent connections** (the two-connection test
  INC-BKP-001 flagged as a reasonable non-blocking follow-up, now done): a
  fresh `backup_reader` connection rejects `INSERT`/`UPDATE`/`DELETE` with
  `cannot execute ... in a read-only transaction` by default. To isolate
  whether privilege-denial exists *independent* of that session guard, ran
  `SET default_transaction_read_only = off;` and a fresh `BEGIN;` as
  **separate protocol messages on the same connection** (not one
  semicolon-joined batch, which — as INC-BKP-001 suspected — gets wrapped in
  one implicit transaction whose read-only status is already fixed before
  the `SET` takes effect, reproducing the original ambiguity instead of
  resolving it). With the guard genuinely off for a fresh transaction, the
  `INSERT` still failed, now with `permission denied for table
  administrations` — true privilege-denial, confirmed live, not just by
  static inspection of the migration's `GRANT` list.

**Self-caught false positive, disclosed rather than hidden**: my first FK
integrity checker flagged 3 composite-key constraints as having orphans. A
manual check (explicit, hand-written join) showed zero real orphans — the
checker's bug was pairing `conkey`/`confkey` columns via `unnest()` without
`WITH ORDINALITY`, which does not guarantee positional correspondence for
composite keys. Fixed by adding `WITH ORDINALITY ... ORDER BY ordinality`,
re-ran against all 140 constraints, got a trustworthy 0. Documented because
the task asked for integrity evidence, and a checker bug that silently
produced false negatives would have been worse than one that (briefly) cried
wolf.

## 7. What this does not resolve

- **Storage blob bytes** (the actual file content in the S3-compatible
  object store, as opposed to `storage.objects` metadata in Postgres) are
  untested by this phase — out of scope per this increment's own
  restriction ("No implementar Storage ni R2 en este incremento").
- **`roles.sql`-equivalent** still requires a `postgres`-level connection
  (reading `pg_authid`) — unchanged from INC-BKP-001's conclusion that this
  is low-value for a Supabase-to-Supabase restore.
- **Tested locally only.** Same Postgres/GoTrue images as the real project,
  strong evidence, but the identical test against the actual remote project
  has not run and requires separate human approval to apply the
  `backup_reader` migration there first.
- **Point-in-time row-level repair (Procedure A) itself was not exercised
  here** — this phase validated full-database restore into an empty schema,
  which is Procedure B's use case. Procedure A's row-level `INSERT ON
  CONFLICT`/`UPDATE`-by-primary-key repair flow, enabled by the
  `--column-inserts` format chosen in §2, is a plausible next validation but
  wasn't run in this increment.

## 8. Files created/modified this phase

- `scripts/backup/export-postgres-data.sh` — new. The actual, reproducible
  export command, parameterized by environment variables, no credentials
  inside it. Validated by running it (via stdin into the container, not a
  `docker cp`'d path — see note below) and restoring its exact output.
- `docs/ops/postgres-export-validation-findings.md` — this document.
- `docs/ops/backup-reader-role-findings.md` — amended to point to this
  document and mark its "open problem" section resolved.

No application TypeScript touched. No migration touched or added (the one
from INC-BKP-001 is unchanged). `pnpm typecheck && pnpm lint && pnpm test --
--run` unaffected — nothing in this phase's file set is reachable from any
of those (confirmed by file list, not re-run blindly, since no `.ts`/`.tsx`
file was created or edited).

**Tooling note, for whoever runs this next**: on this Windows/Git-Bash
environment, `docker cp <host-path> container:/path` mangles the
*container-side* destination path through MSYS path translation even with
`MSYS_NO_PATHCONV=1` set. Piping the script into `docker exec -i ... bash -s
< script.sh` avoids the problem entirely (no path argument on the container
side) and is how this script was actually validated.
