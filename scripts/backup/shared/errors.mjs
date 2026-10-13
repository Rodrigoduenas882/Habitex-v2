// Error types shared across the PostgreSQL and Storage backup legs, so an
// orchestrator (run-backup.mjs) can catch one error class regardless of
// which leg threw it, instead of two classes that happen to have the same
// name but aren't `instanceof` each other.

export class SnapshotCollisionError extends Error {}
