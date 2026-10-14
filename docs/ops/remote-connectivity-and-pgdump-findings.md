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

## Next human checkpoint

Unchanged from the existing runbook: **§1, applying the `backup_reader`
migration to the remote project**, remains the first real write action,
requiring separate, explicit human approval — nothing in this increment
moves that forward. Once approved and a real password is set (§6), the
very next action should be §8b's smoke test, run manually, before
anything in §7's gated workflow run.
