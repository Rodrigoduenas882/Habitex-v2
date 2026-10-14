// Gate between "a run id exists at the destination" and "it is safe to
// restore from" (INC-BKP-005, step 8: an incomplete or corrupted snapshot
// must never be selectable for restoration). This is deliberately a
// separate, cheap step before any decryption or restore work begins -
// it only ever downloads the two small, non-sensitive summary manifests,
// never the (potentially large) encrypted archives themselves, so
// rejecting a bad snapshot is fast and never requires an identity/private
// key to evaluate.
//
// Three independent reasons a snapshot can be rejected, each reported
// distinctly:
//   1. Either summary is missing at the destination (run never finished
//      uploading, or was only partially uploaded).
//   2. Either summary's own `completeness` field is not "COMPLETE" (a
//      leg had missing objects, or never produced a complete artifact).
//   3. The archive bytes at the destination don't match the summary's
//      recorded `archiveSha256` - corruption or tampering after upload,
//      caught here before ever attempting to decrypt.

import { sha256 } from './age-helpers.mjs'

export class SnapshotNotEligibleError extends Error {
  constructor(message, reasons) {
    super(message)
    this.reasons = reasons
  }
}

async function fetchSummary(s3Client, runId, filename) {
  const bytes = await s3Client.getObject(`${runId}/${filename}`)
  if (bytes === null) {
    return { summary: null, reason: `${filename} not found at destination` }
  }
  let parsed
  try {
    parsed = JSON.parse(bytes.toString('utf8'))
  } catch {
    return { summary: null, reason: `${filename} exists but is not valid JSON` }
  }
  // Found by independent review: JSON.parse can succeed on content that
  // parses to null/0/false/"" - a plausible shape for a truncated or
  // corrupted upload, which is exactly what this function exists to
  // catch. checkLegEligibility's `if (!summary)` branch treats any
  // JS-falsy value as "missing," reusing `reason`, which this function
  // never set for that case - the caller's error message then reads
  // literally "postgres: undefined; storage: undefined", giving an
  // operator during a real incident no actual clue what went wrong.
  if (typeof parsed !== 'object' || parsed === null) {
    return { summary: null, reason: `${filename} parsed as valid JSON but is not an object (got ${JSON.stringify(parsed)})` }
  }
  return { summary: parsed }
}

/**
 * Checks one leg's eligibility (summary present, completeness COMPLETE,
 * archive bytes present and matching the summary's recorded checksum) -
 * does NOT decrypt anything. Returns a list of reasons (empty = eligible).
 */
export async function checkLegEligibility(s3Client, runId, summaryFilename) {
  const reasons = []
  const { summary, reason } = await fetchSummary(s3Client, runId, summaryFilename)
  if (!summary) {
    reasons.push(reason)
    return { eligible: false, reasons, summary: null }
  }
  if (summary.completeness !== 'COMPLETE') {
    reasons.push(`summary reports completeness "${summary.completeness}", not COMPLETE`)
  }
  const archiveBytes = await s3Client.getObject(`${runId}/${summary.archiveFilename}`)
  if (archiveBytes === null) {
    reasons.push(`archive file "${summary.archiveFilename}" referenced by the summary is missing at the destination`)
  } else {
    const actualSha256 = sha256(archiveBytes)
    if (actualSha256 !== summary.archiveSha256) {
      reasons.push(`archive checksum mismatch: summary says ${summary.archiveSha256}, destination has ${actualSha256} - corrupted or tampered`)
    }
  }
  return { eligible: reasons.length === 0, reasons, summary, archiveBytes }
}

/**
 * Checks both legs for `runId` and throws SnapshotNotEligibleError (never
 * returns a "maybe restorable" result) unless both are fully eligible.
 * This is the one function a restore entrypoint should call before doing
 * anything else - the whole point is that no caller can accidentally skip
 * this check and proceed straight to decryption.
 */
export async function selectSnapshotForRestore(s3Client, runId) {
  const postgres = await checkLegEligibility(s3Client, runId, `${runId}.postgres-manifest-summary.json`)
  const storage = await checkLegEligibility(s3Client, runId, `${runId}.manifest-summary.json`)

  const reasons = [...postgres.reasons.map((r) => `postgres: ${r}`), ...storage.reasons.map((r) => `storage: ${r}`)]
  if (reasons.length > 0) {
    throw new SnapshotNotEligibleError(`run id "${runId}" is not eligible for restore: ${reasons.join('; ')}`, reasons)
  }

  return {
    runId,
    postgres: { summary: postgres.summary, archiveBytes: postgres.archiveBytes },
    storage: { summary: storage.summary, archiveBytes: storage.archiveBytes },
  }
}
