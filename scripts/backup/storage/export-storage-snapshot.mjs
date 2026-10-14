#!/usr/bin/env node
// Exports every object in Habitex's private Storage buckets (`receipts`,
// `documents`) into one age-encrypted, checksummed, versioned snapshot.
// INC-BKP-003 - the Storage counterpart to INC-BKP-002's PostgreSQL export.
//
// Pipeline: list every object (recursively, both buckets) -> download each
// into an isolated staging directory, preserving bucket/path structure ->
// write a full manifest (inventory + sha256 + completeness) next to the
// staged files -> pack the staging directory into one buffer (see pack.mjs
// - not tar; a tiny dependency-free format, chosen after Git-Bash's `tar`
// binary proved incompatible with Windows-native Node's path format) ->
// encrypt the packed buffer with age against >=2 independent recipients ->
// write a small, non-sensitive summary manifest next to the final
// `.snapshot.age` artifact -> delete the staging directory (nothing
// unencrypted survives the run except the summary, which deliberately
// carries no paths/tenant ids/checksums of individual objects).
//
// Collision policy: the output directory is named by a run id
// (`<ISO-compact-timestamp>-<6 hex chars>`) and the script refuses to run if
// that exact output directory already exists - it never overwrites a prior
// snapshot. A caller that wants a specific id for testing can set
// SNAPSHOT_RUN_ID explicitly (used by the negative-test suite to prove the
// collision guard fires).
//
// Required environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   SNAPSHOT_OUTPUT_DIR      - where <run_id>.snapshot.age + its summary land
//   AGE_RECIPIENTS           - comma-separated age public keys, >= 2 required
// Optional:
//   SNAPSHOT_BUCKETS         - comma-separated, default "receipts,documents"
//   SNAPSHOT_RUN_ID          - override the generated run id (testing only)
//   SNAPSHOT_STAGING_DIR     - base dir for the isolated staging directory
//                              (default: os.tmpdir())

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createStorageClient } from './storage-client.mjs'
import { packDirectory } from './pack.mjs'
import { generateRunId } from '../shared/run-id.mjs'
import { sha256, encryptBuffer, EncryptionFailedError } from '../shared/age-helpers.mjs'
import { SnapshotCollisionError } from '../shared/errors.mjs'

export { generateRunId, EncryptionFailedError, SnapshotCollisionError }

/**
 * Downloads every object across `buckets` into `stagingDir/objects/<bucket>/<path>`.
 * Never throws on an individual missing object (a 404 between listing and
 * downloading, or a listing crafted by a test to point at a path that never
 * existed) - records it as `status: "MISSING"` in the manifest instead, and
 * the caller surfaces that as a PARTIAL snapshot rather than a silent gap.
 */
async function downloadAll({ client, buckets, stagingDir }) {
  const entries = []
  for (const bucket of buckets) {
    const objects = await client.listAllObjects(bucket)
    for (const object of objects) {
      const bytes = await client.downloadObject(object.bucket, object.path)
      if (bytes === null) {
        entries.push({ ...object, status: 'MISSING', sha256: null })
        continue
      }
      const destPath = path.join(stagingDir, 'objects', object.bucket, object.path)
      await mkdir(path.dirname(destPath), { recursive: true })
      await writeFile(destPath, bytes)
      entries.push({ ...object, status: 'DOWNLOADED', sha256: sha256(bytes), downloadedBytes: bytes.length })
    }
  }
  return entries
}

export async function runExport({
  supabaseUrl = process.env.SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  outputDir = process.env.SNAPSHOT_OUTPUT_DIR,
  recipients = (process.env.AGE_RECIPIENTS ?? '').split(',').filter(Boolean),
  buckets = (process.env.SNAPSHOT_BUCKETS ?? 'receipts,documents').split(',').filter(Boolean),
  runId = process.env.SNAPSHOT_RUN_ID ?? generateRunId(),
  stagingBaseDir = process.env.SNAPSHOT_STAGING_DIR ?? tmpdir(),
  client,
} = {}) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }
  if (!outputDir) {
    throw new Error('SNAPSHOT_OUTPUT_DIR is required')
  }
  if (recipients.length < 2) {
    throw new Error(`AGE_RECIPIENTS must list at least 2 independent recipients, got ${recipients.length}`)
  }

  await mkdir(outputDir, { recursive: true })
  const archivePath = path.join(outputDir, `${runId}.snapshot.age`)
  const summaryPath = path.join(outputDir, `${runId}.manifest-summary.json`)
  // Fast-fail check up front, before doing any of the expensive
  // download/encrypt work below - but this alone is NOT the collision
  // guard (check-then-write has a race window). The real guarantee is the
  // `flag: 'wx'` exclusive-create on the actual writes further down, which
  // atomically fails if the path now exists, no matter how much time
  // passed between this check and that write.
  if (existsSync(archivePath) || existsSync(summaryPath)) {
    throw new SnapshotCollisionError(`snapshot run id "${runId}" already exists at ${outputDir} - refusing to overwrite`)
  }

  const stagingDir = await mkdtemp(path.join(stagingBaseDir, 'habitex-storage-snapshot-'))
  const storageClient = client ?? createStorageClient({ url: supabaseUrl, serviceRoleKey })

  try {
    const entries = await downloadAll({ client: storageClient, buckets, stagingDir })
    const downloaded = entries.filter((e) => e.status === 'DOWNLOADED')
    const missing = entries.filter((e) => e.status === 'MISSING')
    const completeness = missing.length === 0 ? 'COMPLETE' : 'PARTIAL'

    const manifest = {
      runId,
      createdAt: new Date().toISOString(),
      buckets,
      completeness,
      objectCount: entries.length,
      downloadedCount: downloaded.length,
      missingCount: missing.length,
      totalBytes: downloaded.reduce((sum, e) => sum + e.downloadedBytes, 0),
      objects: entries.map((e) => ({
        bucket: e.bucket,
        path: e.path,
        status: e.status,
        sizeBytes: e.sizeBytes,
        mimeType: e.mimeType,
        storageEtag: e.storageEtag,
        storageUpdatedAt: e.storageUpdatedAt,
        sha256: e.sha256,
      })),
    }
    await writeFile(path.join(stagingDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

    const packedBuffer = await packDirectory(stagingDir)
    const archiveBytes = await encryptBuffer(packedBuffer, recipients)
    try {
      await writeFile(archivePath, archiveBytes, { flag: 'wx' })
    } catch (cause) {
      if (cause.code === 'EEXIST') {
        throw new SnapshotCollisionError(`snapshot run id "${runId}" already exists at ${outputDir} - refusing to overwrite`)
      }
      throw cause
    }
    const summary = {
      runId,
      createdAt: manifest.createdAt,
      buckets,
      completeness,
      objectCount: manifest.objectCount,
      downloadedCount: manifest.downloadedCount,
      missingCount: manifest.missingCount,
      totalBytes: manifest.totalBytes,
      archiveFilename: path.basename(archivePath),
      archiveSha256: sha256(archiveBytes),
      archiveBytes: archiveBytes.length,
      recipientCount: recipients.length,
    }
    try {
      await writeFile(summaryPath, JSON.stringify(summary, null, 2), { flag: 'wx' })
    } catch (cause) {
      if (cause.code === 'EEXIST') {
        throw new SnapshotCollisionError(`snapshot run id "${runId}" already exists at ${outputDir} - refusing to overwrite`)
      }
      throw cause
    }

    return { runId, archivePath, summaryPath, manifest, summary }
  } finally {
    await rm(stagingDir, { recursive: true, force: true })
  }
}

async function main() {
  const result = await runExport()
  console.log(JSON.stringify(result.summary, null, 2))
  if (result.summary.completeness !== 'COMPLETE') {
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message)
    process.exitCode = 1
  })
}
