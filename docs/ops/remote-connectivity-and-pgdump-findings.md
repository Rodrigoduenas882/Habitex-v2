# Remote connectivity and `pg_dump` version findings (INC-BKP-006)

Follow-up to the read-only remote verification done ahead of the
`backup_reader` activation checkpoint (INC-BKP-005's own runbook review).
That review surfaced two assumptions the pipeline had never actually
tested against the real remote project, because every prior increment
(INC-BKP-001 through INC-BKP-005) validated exclusively against a local
Supabase stack. This increment investigates and fixes both, **without**
creating the `backup_reader` role, applying any migration, or running any
real backup — those remain separately gated (see
`docs/ops/activation-runbook.md`).

## 1. `pg_dump` major-version mismatch

**The problem:** `.github/workflows/backup.yml` installed `pg_dump` via
`sudo apt-get install -y postgresql-client`, with no version pin. On the
`ubuntu-24.04` GitHub-hosted runner image, Ubuntu's own `noble` apt
repository ships `postgresql-client` as a metapackage depending on
`postgresql-client-16` — **PostgreSQL 16**, not 17. The remote project
confirmed to run **PostgreSQL 17.6** (`select version()`, read-only MCP
query against the real project). `supabase/config.toml`'s own
`[db] major_version = 17` already documents the intended server version —
the workflow simply never pinned its client to match it.

**Why this breaks, not just a version-skew nitpick:** `pg_dump` enforces
its own documented compatibility rule — it supports dumping from a server
version *older than or equal to* its own, never a *newer* one. A
PostgreSQL 16 `pg_dump` against a 17.6 server fails outright
(`server version mismatch`) rather than producing a degraded-but-working
dump. This would have surfaced only at the §7 human checkpoint's first
real manual run — i.e. the first time this pipeline touched the real
project — rather than being caught here, read-only, ahead of time.

**Fix:** `.github/workflows/backup.yml`'s "Install PostgreSQL client" step
now adds the official PGDG apt repository
(`apt.postgresql.org`, GPG key `ACCC4CF8` via the modern
`/usr/share/postgresql-common/pgdg` keyring path) and installs
`postgresql-client-17` specifically, then a new step runs
`pg_dump --version` and fails the job immediately if it doesn't report
major version 17 — so a future Ubuntu runner-image bump that changes
noble's default can't silently reintroduce this exact failure mode
unnoticed.

**What was NOT changed:** `scripts/backup/export-postgres-data.sh` itself
needed no changes — it already made no version-specific assumptions
beyond what `pg_dump` 17 (or any reasonably recent major version) supports
natively (`--quote-all-identifier`, `--column-inserts`, exclude-schema
regex). The `\restrict`/`\unrestrict` comment-out workaround already in
that script was itself added defensively for a **forward**-compat case
(pg_dump 18+ emitting those against an older `psql`) — unrelated to, and
unaffected by, this fix.

## 2. Direct connection vs. Supavisor session-mode pooler

**The problem, read-only-verified:**

- A direct Postgres connection to a Supabase project
  (`db.<project-ref>.supabase.co:5432`) defaults to **IPv6-only** unless
  the paid IPv4 add-on is purchased (verified against Supabase's own
  docs, `supabase.com/docs/guides/platform/ipv4-address`: the add-on
  "swaps the project's IPv6 (AAAA) DNS record for an IPv4 (A) record" —
  implying the unmodified default is IPv6-only, not dual-stack).
- GitHub-hosted `ubuntu-24.04` runners do not reliably have outbound IPv6
  connectivity to arbitrary public IPv6 endpoints (community-reported,
  longstanding; Supabase's own IPv4-compatibility docs exist specifically
  because this class of client — CI runners among them — routinely can't
  reach the IPv6-only default).
- Supabase's official documentation (`supabase.com/docs/guides/platform/ipv4-address`)
  states plainly: "Supavisor connection strings are IPv4-compatible
  alternatives to direct connections" — both pooler modes "Always [use]
  an IPv4 address."
- Of the two Supavisor modes, **only session mode (port 5432)** is
  appropriate for `pg_dump`. Supabase's connecting-to-postgres docs:
  transaction mode (port 6543) is for "serverless and edge functions,
  which open many short-lived connections" and explicitly "does not
  support prepared statements." Session mode is described as "an
  alternative to a direct connection when you connect from an IPv4-only
  network" and supports prepared statements without restriction — i.e.
  it behaves like the single persistent session `pg_dump` needs, which
  transaction mode's connection multiplexing does not guarantee.
- **Username format changes under the shared pooler.** Supabase's docs:
  "Direct connections and the dedicated pooler use `postgres`. Shared
  pooler connections use `postgres.[PROJECT-REF]`. If you connect as a
  custom role through the shared pooler, the username is
  `[ROLE].[PROJECT-REF]`." The activation runbook's original §6 table
  listed `BACKUP_PGUSER` as plain `backup_reader` — correct only for a
  direct connection, silently wrong the moment `BACKUP_PGHOST` becomes a
  pooler host. None of `scripts/backup`'s own code hardcoded this
  assumption (every script forwards `PGUSER` through as an opaque env
  var, with no `--role` flag anywhere — confirmed by reading
  `export-postgres-data.sh`, `export-postgres-encrypted.mjs`,
  `run-backup.mjs`), so the bug lived entirely in the runbook's
  documented value, not in application code. It is now fixed in both
  places (see below).
- **The pooler hostname itself cannot be derived from the project ref.**
  Supabase's docs warn the per-cluster index in
  `aws-<index>-<region>.pooler.supabase.com` is "not part of the region
  name" and explicitly say to copy the host from the dashboard's Connect
  dialog rather than construct it. This runbook does not attempt to; it
  documents that the real value must come from the dashboard.

**What remains explicitly UNVERIFIED (by design, not oversight):** every
claim above comes from Supabase's own published documentation, read via
automated fetch, cross-checked for internal consistency across three
separate pages (connecting-to-postgres, the Supavisor FAQ, and the IPv4
compatibility guide). **None of it has been tested against a real
connection** — this repo has no real `backup_reader` credential, and
creating one, or opening any real connection with one, is outside this
increment's authorization (no roles created, no migrations applied, no
real backup run — per the task's own restrictions). The activation
runbook's new §8b names the exact smoke test to run, manually, once a
real credential exists, before relying on any of this for the real
pipeline.

## 3. Code changes

- **New: `scripts/backup/shared/pg-connection-guard.mjs`** —
  `assertValidPgEnv({ PGHOST, PGUSER })` throws a new
  `InvalidPgConnectionError` (added to `shared/errors.mjs`) when `PGHOST`
  matches a Supavisor pooler host (`*.pooler.supabase.com`) and either
  `PGPORT` isn't `5432` (session mode) or `PGUSER` isn't in
  `<role>.<project-ref>` shape. No-ops for a direct connection or a
  local/Docker host, where a bare role name and whatever port they already
  use are both correct. This converts both bug classes found above (a
  pooler host paired with a bare role name, or paired with transaction
  mode's port 6543) from a confusing, generic Postgres authentication
  failure — or worse, a dump that runs but is quietly unsafe — into an
  immediate, actionable error naming the real problem. It can only check
  that the port selects session mode and that the username's *shape* is
  right — it has no way to confirm the project-ref segment is the
  *correct* one short of a real connection.
  (Caught by independent review: the first version of this guard checked
  only `PGUSER`, leaving the port 6543 mistake — named as equally critical
  earlier in this same document — completely unchecked. Fixed before this
  increment's own validation pass completed.)
- **Wired into `scripts/backup/postgres/export-postgres-encrypted.mjs`**:
  `runPostgresExport()` now calls `assertValidPgEnv(pgEnv)` immediately
  after its existing required-env-var check, before any directory is
  created or `pg_dump` is spawned.
- **Tests: `scripts/backup/shared/test-pg-connection-guard.mjs`** — same
  standalone, dependency-free pattern as `test-s3-client.mjs` (no
  network/Docker/age needed). 14 cases: pooler-host detection (positive,
  case-insensitive, and negative for direct/local hosts); the two no-op
  paths (direct connection, local/Docker host, both with a bare role name
  and no port check); the accepting paths (session mode port + valid
  username, including a numeric `5432` and a username with incidental
  whitespace); and rejection paths covering both checks — transaction
  mode's port 6543 even with an otherwise-valid username, a missing port,
  a bare role name (the original bug class), an uppercase/invalid
  project-ref segment, an empty role segment, and an undefined/empty
  `PGUSER`. All 14 pass
  (`node scripts/backup/shared/test-pg-connection-guard.mjs`).

## 4. Documentation changes

- `.github/workflows/backup.yml` — PGDG-pinned `postgresql-client-17`
  install + version-verification step (§1 above); a comment above the
  `Run backup` step's `env:` block pointing at this document and the
  runbook's §6 for the pooler/username requirement.
- `docs/ops/activation-runbook.md`:
  - §0 now names this document and summarizes the two corrected
    assumptions, flagged as unverified pending §8b.
  - §6's table: `BACKUP_PGHOST` now specifies the session-mode pooler host
    (from the dashboard, not derived); `BACKUP_PGPORT` is `5432`
    (session mode), not `6543`; `BACKUP_PGUSER` is
    `backup_reader.<project-ref>`, not bare `backup_reader`. A prose block
    above the table explains why, citing the same Supabase documentation
    quoted above.
  - New §8b: the manual smoke test to run once real credentials exist —
    a single-table `pg_dump` through the real pooler, then the full
    `export-postgres-data.sh` — with concrete diagnostics for the three
    most likely failure modes (host/connectivity, username, `pg_dump`
    version).
  - §9's authorization checklist gained two items: the §8b smoke test
    passing, and the §6 secrets actually using pooler-shaped values.

## 5. Validation run this increment

- `node scripts/backup/shared/test-pg-connection-guard.mjs` — **8/8
  passed**.
- `pnpm lint` — see command output recorded alongside this report.
- `pnpm build` — see command output recorded alongside this report.
- `pnpm test` (vitest, main app suite) — run to confirm the backup-tooling
  changes (plain `.mjs`, not part of the Vite/Vitest graph) didn't
  regress anything in the frontend; backup scripts are intentionally not
  wired into this suite (same reasoning `test-s3-client.mjs` documents).
- **Not run** (require a live local Supabase stack + Docker, unavailable
  on this machine — same limitation INC-BKP-001/002/004/005 already
  documented): `scripts/backup/test-run-backup.mjs`,
  `scripts/backup/storage/test-storage-snapshot.mjs`,
  `scripts/backup/test-recover-from-destination.mjs`,
  `scripts/backup/test-select-snapshot.mjs`. None of these exercise the
  new guard's pooler-rejection path anyway (their fixtures use
  `127.0.0.1`/Docker hosts, which the guard no-ops for); the guard itself
  is fully covered by its own standalone suite above.
- `pnpm test:e2e` — **not run**. Nothing in this increment touches
  browser-observable behavior (workflow YAML, a Node backup script, and
  ops docs only); CLAUDE.md calls for `test:e2e` "cuando el cambio afecte
  comportamiento de browser/E2E," which this doesn't.

## 6. Residual risks / what's still open

- Everything in §2 above is **documentation-verified, not
  connection-verified**. The single highest-value next step is the §8b
  smoke test, which requires a real `backup_reader` password — a separate
  human approval this increment does not request.
- The pooler hostname's exact value (`aws-<index>-<region>...`) is
  unknown until a human opens the dashboard's Connect dialog; nothing in
  this repo can discover or verify it read-only (it isn't exposed through
  any of the available read-only Supabase MCP tools, which cover schema,
  data, logs, and advisors, not connection-string metadata).
- `pg-connection-guard.mjs` validates username *shape* and session-mode
  *port* only, not that the project-ref segment is actually correct. A
  `backup_reader.<wrong-ref>` on port 5432 would still pass the guard and
  only fail at actual Postgres authentication — acceptable, since
  confirming the correct ref requires the same real connection §8b
  already calls for.
- Independent review (post-implementation) also confirmed this guard
  cannot and does not validate `PGHOST`/`PGPASSWORD` values themselves
  (only `PGPORT` and `PGUSER`'s relationship to a pooler `PGHOST`) — a
  `PGHOST` that is simply the wrong pooler cluster (e.g. the wrong
  `<index>`/`<region>`), or an incorrect `PGPASSWORD`, both still only
  surface at the real connection in §8b.
- SSL/TLS mode was not investigated as part of this increment (out of the
  two blockers the user asked to resolve) — `scripts/backup`'s PG env
  passthrough sets no `PGSSLMODE`, so libpq's default (`prefer`) applies,
  which negotiates SSL when the server offers it (Supabase does) without
  requiring an explicit setting. Flagged here rather than silently
  assumed; revisit only if §8b's real smoke test surfaces an SSL-specific
  failure.

## 7. Real Supavisor smoke test results (post-activation)

Everything flagged as "documentation-verified, not connection-verified"
in §6 above has since been tested for real, after a human applied the
`backup_reader` migration to the remote project (via the Dashboard SQL
Editor — see §8 below for the version this created) and set its password
out-of-band. Two real runs, both read-only, both manual, both outside
this repo's own tool-calling (per this increment's restriction on running
anything credentialed from inside Claude Code):

- **First attempt failed**: `FATAL: password authentication failed for
  user "backup_reader"`. Investigated read-only (official Supabase docs
  via `search_docs`, `pg_authid` via `execute_sql`, and
  `supavisor_logs`/`postgres_logs` via `query_logs`) rather than assumed.
  Root cause, evidenced directly in `supavisor_logs`: the failed attempt
  (`17:54:28`) landed on `"SecretChecker not started, using a one-off
  auth_query connection"` immediately before the auth error — Supavisor's
  own credential cache/checker had never been warmed for this brand-new
  role, the same cold-start path Supabase's own troubleshooting doc
  documents for a password changed shortly before a connection attempt
  ("Supavisor error: 'password authentication failed' after rotating
  database password" — not a bug, resolves on a bare retry).
  `pg_authid` confirmed the password hash was correctly stored and the
  role wasn't expired, ruling out the two other documented causes before
  concluding this was the cache/cold-start path specifically.
- **Retry succeeded**: `current_user = backup_reader` (exact match),
  `transaction_read_only = on`, `SELECT count(*) FROM
  public.administrations` executed without error (returned `0` at the
  time — the project had no real tenant data yet; `1` by the time of a
  later re-run, both are valid, non-error results), `ALL CHECKS PASSED`.
  `PGPASSWORD` cleared from the shell afterward.
- **`pg_dump` itself validated separately, against real data**: schema-
  only `pg_dump --schema-only --table "public.administrations"` through
  the real Supavisor session-mode pooler. Asserted non-empty, not just
  exit code 0: output contained the real `CREATE TABLE` statement and at
  least 3 of `administrations`' 5 known columns — ruling out the
  "`pg_dump` exits 0 but silently dumped nothing" false-positive this
  increment's own §8b smoke test design was built to catch. **PASSED.**

This closes §6's primary residual risk (the pooler/username/port design
was documentation-verified only) with a real, successful round-trip.
Still open, as noted in §6: `pg-connection-guard.mjs` cannot and does not
verify the project-ref segment or `PGHOST` are the *correct* pooler
cluster beyond their *shape* — that still rests on this successful real
connection, not on any static check.

## 8. Migration version reconciliation (`20261013120000` → `20261014170751`)

**The divergence:** this file was originally authored and committed as
`supabase/migrations/20261013120000_create_backup_reader_role.sql`. Local
dev (`supabase start`/`db reset`) tracks it under that same version in
its own `supabase_migrations.schema_migrations`. The human who applied it
to the real remote project did so via the Dashboard's SQL Editor — not
`supabase db push` — which auto-records executed DDL into
`supabase_migrations.schema_migrations` stamped with the **execution
timestamp**, not the file's embedded version. The remote project
therefore tracks this exact statement set under version
`20261014170751` (`2026-10-14 17:07:51 UTC`), not `20261013120000`.

**Verified read-only, both sides, before any file was touched:**
- Remote's recorded `statements` column (queried directly from
  `supabase_migrations.schema_migrations`) and this file's SQL are
  identical, modulo SQL keyword casing only.
- `backup_reader`'s resulting role attributes — `rolcanlogin`,
  `rolbypassrls`, `rolsuper`, `rolcreatedb`, `rolcreaterole`,
  `rolconnlimit`, `rolconfig` (`default_transaction_read_only=on`), and
  its single `pg_read_all_data` grant with no `ADMIN OPTION` — are
  byte-for-byte identical between the local dev database and the real
  remote project.
- No other migration file, locally or remotely, already uses version
  `20261014170751`.

This is a pure version/tracking-number divergence, never a content or
behavioral one — confirmed, not assumed.

**Why a rename, and not something else:** `supabase db push` matches
local files against remote tracking by **version number**, not content.
Leaving both versions in place would mean a future `db push` sees
`20261013120000` as a distinct, never-applied-remotely migration and
attempts to run it — harmless here only because every statement in it is
idempotent (`IF NOT EXISTS`, `GRANT`, `ALTER ROLE SET`), but it would
permanently pollute the migration history with a phantom entry. Adding a
*second* new file under `20261014170751` instead of renaming would
duplicate the same operation across two files — worse, not better.
Renaming is the only outcome that leaves exactly one file whose version
matches what the remote project actually tracks, with zero remote writes
of any kind (a local `git mv`, nothing else).

**Approved exception:** CLAUDE.md §5 states "las migrations ya aplicadas
no se modifican nunca; un cambio siempre es una migration nueva." This
rename is an explicit, human-approved exception to that rule — approved
specifically because only the filename/embedded version identifier
changed (confirmed via `git diff --stat`: 0 insertions, 0 deletions,
rename-only), the SQL content is untouched line-for-line, and because a
content-preserving rename is the only outcome that avoids either a
phantom pending migration or a duplicate file (above). No remote or
local database write of any kind was performed to produce this rename —
`supabase db reset`, `db push`, and `migration repair` were all
deliberately not run.

**Known, accepted side effect:** the local dev database's own
`supabase_migrations.schema_migrations` still reads `20261013120000` for
this entry until the next `supabase db reset` — routine local-dev
bookkeeping that self-heals on the next reset, not a new risk this
rename introduces.

## Next human checkpoint

§7 above closes out the connectivity/identity/read-capability validation
this document originally called for — `backup_reader` is now confirmed
working end-to-end against the real project via Supavisor session mode,
both for a plain query and for `pg_dump` itself. §8's rename is a local,
zero-remote-write bookkeeping fix, committed alongside this document but
not yet pushed.

What remains, per `docs/ops/activation-runbook.md`, is unchanged in kind
even though §7 now satisfies its §8b smoke test: R2 bucket + Bucket Lock
configuration, the 2 real age identities, all of §6's GitHub secrets
(now with the corrected pooler host/port/username confirmed working for
real), and only then §7's single gated manual workflow run — still
requiring its own separate human approval, still with the cron trigger
left commented out.
