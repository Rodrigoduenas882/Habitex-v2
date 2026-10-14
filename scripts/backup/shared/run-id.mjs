// The one run-id generator for the whole backup pipeline (INC-BKP-004).
// Moved here from storage/export-storage-snapshot.mjs (INC-BKP-003), which
// now imports it from here instead of keeping its own copy - the
// orchestrator (run-backup.mjs) needs the exact same id shared between the
// PostgreSQL and Storage legs of one run, so there can only be one
// implementation, not two that happen to agree.

import { randomBytes } from 'node:crypto'

function isoCompact(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
}

export function generateRunId() {
  return `${isoCompact(new Date())}-${randomBytes(3).toString('hex')}`
}
