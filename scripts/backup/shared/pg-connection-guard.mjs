// Validates one specific, previously-unverified assumption about the
// PostgreSQL connection env before it ever reaches `pg_dump` (INC-BKP-006).
//
// Why this exists: the activation runbook originally assumed a direct
// connection (`db.<project-ref>.supabase.co`, IPv6-only) would work from
// a GitHub-hosted runner. It doesn't - those runners cannot reliably reach
// IPv6-only endpoints (see docs/ops/remote-connectivity-and-pgdump-findings.md,
// INC-BKP-006). The documented fallback for an IPv4-only client is
// Supabase's Supavisor pooler in **session mode** (port 5432, not 6543 -
// transaction mode does not support the single long-lived session
// `pg_dump` needs, and does not support prepared statements). Connecting
// through the shared pooler also changes the required username: Supabase's
// own docs state plainly that "Direct connections and the dedicated
// pooler use `postgres`. Shared pooler connections use
// `postgres.[PROJECT-REF]`. If you connect as a custom role through the
// shared pooler, the username is `[ROLE].[PROJECT-REF]`." A bare
// `backup_reader` (correct for a direct connection, and for local Docker
// testing) silently becomes the WRONG username the moment PGHOST is
// changed to a pooler host, and a PGPORT of `6543` silently selects the
// wrong (transaction) mode against that same pooler host - this guard
// catches both mismatches before spawning pg_dump, rather than surfacing
// either as a generic Postgres auth failure (username) or a dump that
// runs but is quietly unsafe (port) with no explanation.
//
// This guard checks necessary conditions (the username SHAPE is right,
// the port selects session mode), not sufficient ones - it cannot confirm
// the project ref segment is actually correct, or that Supavisor itself
// accepts the connection. That requires a real connection, which this
// increment is explicitly not authorized to attempt (see
// docs/ops/activation-runbook.md checkpoint).

import { InvalidPgConnectionError } from './errors.mjs'

const POOLER_HOST_PATTERN = /\.pooler\.supabase\.com$/i
const SESSION_MODE_PORT = '5432'

/** True if `host` is a Supavisor shared pooler host (session or transaction mode share the same hostname; only the port differs). */
export function isSupavisorPoolerHost(host) {
  return typeof host === 'string' && POOLER_HOST_PATTERN.test(host.trim())
}

/**
 * Throws InvalidPgConnectionError if `pgEnv.PGHOST` is a Supavisor pooler
 * host and either:
 *   - `pgEnv.PGPORT` is not `5432` (session mode) - most commonly a
 *     stray `6543` (transaction mode), which `pg_dump` cannot safely use; or
 *   - `pgEnv.PGUSER` is not in the `<role>.<project-ref>` shape the
 *     shared pooler requires.
 * No-ops for a direct connection (`db.*.supabase.co`) or a local host
 * (127.0.0.1, Docker service names, etc.) - those keep using the bare
 * role name and whatever port they already use, which is correct for them.
 */
export function assertValidPgEnv({ PGHOST, PGPORT, PGUSER } = {}) {
  if (!isSupavisorPoolerHost(PGHOST)) {
    return
  }
  const port = typeof PGPORT === 'string' ? PGPORT.trim() : PGPORT
  if (String(port ?? '') !== SESSION_MODE_PORT) {
    throw new InvalidPgConnectionError(
      `PGPORT "${PGPORT}" is not valid for a Supavisor pooler connection used by pg_dump (PGHOST="${PGHOST}"). ` +
        `pg_dump requires Supavisor SESSION MODE (port ${SESSION_MODE_PORT}), never transaction mode (port 6543) - ` +
        'transaction mode does not support the single persistent session pg_dump needs, nor prepared statements - see ' +
        'docs/ops/remote-connectivity-and-pgdump-findings.md (INC-BKP-006).',
    )
  }
  const username = typeof PGUSER === 'string' ? PGUSER.trim() : PGUSER
  const parts = typeof username === 'string' ? username.split('.') : []
  const [role, projectRef] = parts
  const looksValid = parts.length === 2 && role.length > 0 && /^[a-z0-9]+$/.test(projectRef ?? '')
  if (!looksValid) {
    throw new InvalidPgConnectionError(
      `PGUSER "${PGUSER}" is not valid for a Supavisor pooler connection (PGHOST="${PGHOST}"). ` +
        'Shared pooler connections require the "<role>.<project-ref>" username format ' +
        '(e.g. "backup_reader.<project-ref>"), not a bare role name - see ' +
        'docs/ops/remote-connectivity-and-pgdump-findings.md (INC-BKP-006).',
    )
  }
}
