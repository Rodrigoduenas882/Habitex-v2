// Error types shared across the PostgreSQL and Storage backup legs, so an
// orchestrator (run-backup.mjs) can catch one error class regardless of
// which leg threw it, instead of two classes that happen to have the same
// name but aren't `instanceof` each other.

export class SnapshotCollisionError extends Error {}

// Thrown by shared/pg-connection-guard.mjs (INC-BKP-006) when the
// PostgreSQL connection env looks structurally wrong for the host it is
// pointed at - e.g. a Supavisor pooler host paired with a username that
// has not been suffixed with the project ref. A misconfigured value here
// fails at the Postgres authentication layer too, but with a generic
// "password authentication failed" error that gives no hint about *why* -
// this exists to fail earlier, with a message that names the actual
// mistake.
export class InvalidPgConnectionError extends Error {}
