#!/usr/bin/env node
// INC-BKP-005: the other half of run-backup.mjs - given only a run id and
// an S3/R2-compatible destination, recovers both legs' plaintext bytes.
// This is the script a real disaster recovery starts from: no local
// staging artifacts are assumed to exist (run-backup.mjs's staging
// directory is deleted at the end of every run, by design - the only
// durable copy is at the destination).
//
// Pipeline: shared/select-snapshot.mjs gates the run id (step 8 - refuses
// anything not COMPLETE and checksum-clean, before any decryption is
// attempted) -> download both archives -> decrypt each with the supplied
// identity -> for PostgreSQL, the decrypted bytes ARE the plaintext SQL
// dump (caller pipes them into psql); for Storage, unpack via pack.mjs
// into outputDir/objects/<bucket>/<path>, exactly as
// storage/restore-storage-snapshot.mjs already does.
//
// This script does NOT restore PostgreSQL by executing SQL itself and does
// NOT re-upload Storage objects to a live Supabase project - restoring
// against a real database/Storage instance is a separate, explicit step
// (see docs/ops/disaster-recovery-validation-findings.md's runbook) so
// that recovering bytes from the destination is never silently coupled to
// also mutating a target environment.
//
// Required args/env:
//   node recover-from-destination.mjs <runId> <identity-file> <output-dir>
//   R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createS3Client } from './shared/s3-client.mjs'
import { selectSnapshotForRestore } from './shared/select-snapshot.mjs'
import { decryptBuffer } from './shared/age-helpers.mjs'
import { unpackToDirectory } from './storage/pack.mjs'

export async function recoverFromDestination({ runId, identityPath, outputDir, r2Config }) {
  const s3 = createS3Client(r2Config)

  // Gate 1: refuses anything not COMPLETE/checksum-clean before any
  // decryption is attempted - this call alone is what step 8 requires.
  const selection = await selectSnapshotForRestore(s3, runId)

  const postgresPlaintext = await decryptBuffer(selection.postgres.archiveBytes, identityPath)
  const storagePacked = await decryptBuffer(selection.storage.archiveBytes, identityPath)

  await mkdir(outputDir, { recursive: true })
  const postgresSqlPath = path.join(outputDir, `${runId}.postgres.sql`)

  // Found by independent review: if unpackToDirectory below throws partway
  // through (a corrupt pack index, or an UnsafeArchiveEntryError on a
  // later entry - see pack.mjs), outputDir would otherwise be left holding
  // a partially-written mix of the postgres dump and some-but-not-all
  // storage objects, indistinguishable from a real, complete recovery to
  // anyone just glancing at the directory. On any failure past this point,
  // the whole outputDir is renamed aside (never deleted - the partial
  // bytes may still be useful for diagnosing why it failed) before the
  // original error propagates, so a half-written outputDir can never be
  // mistaken for a successful one.
  try {
    await writeFile(postgresSqlPath, postgresPlaintext)

    // unpackToDirectory writes exactly what export-storage-snapshot.mjs
    // packed: objects/<bucket>/<path> plus manifest.json at the root -
    // this is the same layout storage/restore-storage-snapshot.mjs
    // already reads from, kept identical here rather than inventing a new one.
    const storageOutputDir = path.join(outputDir, 'storage')
    await mkdir(storageOutputDir, { recursive: true })
    await unpackToDirectory(storagePacked, storageOutputDir)
    const storageManifest = JSON.parse(await readFile(path.join(storageOutputDir, 'manifest.json'), 'utf8'))

    return {
      runId,
      postgresSqlPath,
      postgresSummary: selection.postgres.summary,
      storageOutputDir,
      storageManifest,
      storageSummary: selection.storage.summary,
    }
  } catch (cause) {
    const partialDir = `${outputDir}.partial-${Date.now()}`
    try {
      await rename(outputDir, partialDir)
    } catch {
      // Best-effort only - if even the rename fails, the original error
      // below is still the one that matters.
    }
    throw cause
  }
}

async function main() {
  const [runId, identityPath, outputDir] = process.argv.slice(2)
  if (!runId || !identityPath || !outputDir) {
    console.error('usage: recover-from-destination.mjs <runId> <identity-file> <output-dir>')
    process.exitCode = 2
    return
  }
  const r2Config = {
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
  }
  const result = await recoverFromDestination({ runId, identityPath, outputDir, r2Config })
  console.log(
    JSON.stringify(
      { runId: result.runId, postgresSqlPath: result.postgresSqlPath, storageOutputDir: result.storageOutputDir },
      null,
      2,
    ),
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message)
    process.exitCode = 1
  })
}
