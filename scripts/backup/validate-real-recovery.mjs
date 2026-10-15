#!/usr/bin/env node
// INC-BKP-007: drill-specific orchestrator for validating a REAL production
// backup run end-to-end, without ever executing SQL or re-uploading
// Storage objects itself - those remain separate, explicit, human-run
// steps (see docs/ops/real-recovery-drill-plan.md). Built entirely from
// already-validated building blocks, never reimplemented:
//   - shared/select-snapshot.mjs's selectSnapshotForRestore() - the same
//     eligibility gate used in production, refuses anything not COMPLETE
//     and checksum-clean before any decryption is attempted.
//   - shared/age-helpers.mjs's decryptBuffer() - the same decrypt path
//     run-backup.mjs/recover-from-destination.mjs already use.
//   - storage/restore-storage-snapshot.mjs's runRestore() - the same
//     3-layer Storage verification (archive checksum -> decrypt ->
//     per-object checksum) already validated in INC-BKP-005.
//
// What this script adds, specifically for a real-production drill, that
// the existing scripts don't already do on their own:
//   1. An EXPLICIT, printed 3-way hash cross-check per leg (the R2-
//      downloaded bytes' own sha256, the summary manifest's recorded
//      sha256, and an externally-reported expected sha256 - e.g. one
//      copied from a GitHub Actions run's own log) - the existing gate
//      already enforces downloaded-vs-summary internally, but never
//      surfaces a third, independently-sourced comparison or prints any
//      of it for a human to read and sign off on.
//   2. Writes both raw encrypted archives + their summaries to outputDir -
//      a forensic record of exactly what this drill downloaded, and lets
//      restore-storage-snapshot.mjs's own CLI be re-run independently
//      against them later if needed, without a second network fetch.
//
// This script never touches the identity file's contents directly - it
// only ever passes its PATH to age-helpers.mjs's decryptBuffer(), which
// shells out to the real `age` binary. Nothing here prints, logs, or
// stores private key material.
//
// Required args: node validate-real-recovery.mjs <runId> <identity-file> <output-dir>
// Optional args: [expectedPostgresSha256] [expectedStorageSha256]
// Required env: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createS3Client } from './shared/s3-client.mjs'
import { selectSnapshotForRestore } from './shared/select-snapshot.mjs'
import { decryptBuffer, sha256 } from './shared/age-helpers.mjs'
import { runRestore } from './storage/restore-storage-snapshot.mjs'

/**
 * Compares up to 3 named hash sources for one leg - pure function, no I/O,
 * the one new piece of logic this drill adds (kept testable in isolation,
 * see test-validate-real-recovery.mjs). `null`/`undefined` sources are
 * omitted from the comparison (an externally-reported hash is optional),
 * but at least one source is always present in real use (summaryRecorded).
 */
export function crossCheckHashes(leg, sources) {
  const present = Object.entries(sources).filter(([, v]) => v != null)
  const distinct = new Set(present.map(([, v]) => v.toLowerCase()))
  return {
    leg,
    sources: Object.fromEntries(present),
    match: distinct.size <= 1,
  }
}

export async function validateRealRecovery({
  runId,
  identityPath,
  outputDir,
  expectedPostgresSha256,
  expectedStorageSha256,
  r2Config,
}) {
  const s3 = createS3Client(r2Config)

  // Gate - refuses anything not COMPLETE/checksum-clean, identical to the
  // check a real production restore would go through.
  const selection = await selectSnapshotForRestore(s3, runId)

  const postgresCrossCheck = crossCheckHashes('postgres', {
    summaryRecorded: selection.postgres.summary.archiveSha256,
    recomputedFromDownload: sha256(selection.postgres.archiveBytes),
    externallyReported: expectedPostgresSha256,
  })
  const storageCrossCheck = crossCheckHashes('storage', {
    summaryRecorded: selection.storage.summary.archiveSha256,
    recomputedFromDownload: sha256(selection.storage.archiveBytes),
    externallyReported: expectedStorageSha256,
  })

  await mkdir(outputDir, { recursive: true })

  // Forensic record of exactly what this drill downloaded - written
  // locally under the caller-supplied outputDir, nowhere else.
  const postgresArchivePath = path.join(outputDir, selection.postgres.summary.archiveFilename)
  const postgresSummaryPath = path.join(outputDir, `${runId}.postgres-manifest-summary.json`)
  const storageArchivePath = path.join(outputDir, selection.storage.summary.archiveFilename)
  const storageSummaryPath = path.join(outputDir, `${runId}.manifest-summary.json`)
  await writeFile(postgresArchivePath, selection.postgres.archiveBytes)
  await writeFile(postgresSummaryPath, JSON.stringify(selection.postgres.summary, null, 2))
  await writeFile(storageArchivePath, selection.storage.archiveBytes)
  await writeFile(storageSummaryPath, JSON.stringify(selection.storage.summary, null, 2))

  // PostgreSQL leg: decrypt only - this script never executes the SQL
  // itself. Restoring it into a disposable container is a separate,
  // explicit, human-run step (see docs/ops/real-recovery-drill-plan.md).
  const postgresPlaintext = await decryptBuffer(selection.postgres.archiveBytes, identityPath)
  const postgresSqlPath = path.join(outputDir, `${runId}.postgres.sql`)
  await writeFile(postgresSqlPath, postgresPlaintext)

  // Storage leg: full 3-layer verification, reusing
  // restore-storage-snapshot.mjs unmodified rather than reimplementing it.
  // This also never re-uploads anything to any Storage instance (local or
  // remote) - it only verifies the decrypted, unpacked bytes on disk.
  const storageOutputDir = path.join(outputDir, 'storage')
  const storageResult = await runRestore({
    archivePath: storageArchivePath,
    summaryPath: storageSummaryPath,
    identityPath,
    outputDir: storageOutputDir,
  })

  return {
    runId,
    postgresCrossCheck,
    storageCrossCheck,
    postgresSqlPath,
    postgresSummary: selection.postgres.summary,
    storageResult,
  }
}

async function main() {
  const [runId, identityPath, outputDir, expectedPostgresSha256, expectedStorageSha256] = process.argv.slice(2)
  if (!runId || !identityPath || !outputDir) {
    console.error('usage: validate-real-recovery.mjs <runId> <identity-file> <output-dir> [expectedPostgresSha256] [expectedStorageSha256]')
    process.exitCode = 2
    return
  }
  const r2Config = {
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
  }
  const result = await validateRealRecovery({ runId, identityPath, outputDir, expectedPostgresSha256, expectedStorageSha256, r2Config })

  // Deliberately omits raw file contents and full per-object paths beyond
  // what restore-storage-snapshot.mjs's own result already carries
  // (bucket/path/match-result/sizes/hashes - never file bytes).
  console.log(
    JSON.stringify(
      {
        runId: result.runId,
        postgresCrossCheck: result.postgresCrossCheck,
        storageCrossCheck: result.storageCrossCheck,
        postgresSqlPath: result.postgresSqlPath,
        storageRestoreStatus: result.storageResult.restoreStatus,
        storageVerification: result.storageResult.verification,
      },
      null,
      2,
    ),
  )

  const allHashesMatch = result.postgresCrossCheck.match && result.storageCrossCheck.match
  const storageOk = result.storageResult.restoreStatus === 'VERIFIED'
  if (!allHashesMatch || !storageOk) {
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message)
    process.exitCode = 1
  })
}
