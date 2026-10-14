#!/usr/bin/env node
// INC-BKP-004 orchestrator: runs the PostgreSQL leg (INC-BKP-002, wrapped
// with encryption by postgres/export-postgres-encrypted.mjs) and the
// Storage leg (INC-BKP-003, storage/export-storage-snapshot.mjs) under one
// shared run id, uploads both encrypted artifacts (plus their non-sensitive
// summaries) to an S3/R2-compatible destination, verifies each upload by
// downloading it back and re-checking its sha256, and only ever reports
// the combined run as `completeness: "COMPLETE"` when both legs completed
// AND both uploads were verified. Neither leg's own already-validated
// internals are reimplemented here - this file only orchestrates and adds
// the upload/verify/combine/healthcheck layer on top.
//
// Required environment variables:
//   PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD   - PostgreSQL leg
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY           - Storage leg
//   AGE_RECIPIENTS                                    - shared by both legs
//   R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
// Optional:
//   SNAPSHOT_RUN_ID            - override the shared run id (testing)
//   SNAPSHOT_STAGING_DIR       - local staging dir before upload (default: os.tmpdir())
//   PG_EXPORT_DOCKER_CONTAINER - local-dev-only, see postgres/export-postgres-encrypted.mjs
//   HEALTHCHECKS_PING_URL      - optional; no-ops if unset

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { generateRunId } from './shared/run-id.mjs'
import { sha256 } from './shared/age-helpers.mjs'
import { createS3Client } from './shared/s3-client.mjs'
import { createHealthcheckClient, toHealthcheckPayload } from './shared/healthcheck.mjs'
import { runPostgresExport } from './postgres/export-postgres-encrypted.mjs'
import { runExport as runStorageExport } from './storage/export-storage-snapshot.mjs'

async function uploadAndVerifyOne(s3Client, { localPath, remoteKey, expectedSha256 }) {
  const body = await readFile(localPath)
  await s3Client.putObject(remoteKey, body, { ifNoneMatch: '*' })
  const downloaded = await s3Client.getObject(remoteKey)
  if (downloaded === null) {
    return { verified: false, reason: `${remoteKey} not found immediately after upload` }
  }
  const downloadedSha256 = sha256(downloaded)
  if (downloadedSha256 !== expectedSha256) {
    return { verified: false, reason: `sha256 mismatch after upload for ${remoteKey}: expected ${expectedSha256}, got ${downloadedSha256}` }
  }
  return { verified: true }
}

/**
 * Uploads BOTH the encrypted archive and its summary manifest to
 * `${runId}/`, verifying each independently by downloading it back.
 *
 * Found missing during INC-BKP-005's first real end-to-end recovery
 * attempt (not a mocked test): the original version of this function only
 * ever uploaded the archive - the summary manifest never reached the
 * destination at all, which meant `shared/select-snapshot.mjs`'s
 * eligibility check (the very thing that is supposed to gate every
 * restore) had nothing to read. A real round-trip test caught this; no
 * mocked unit test had exercised the actual destination layout closely
 * enough to notice.
 */
async function uploadAndVerify(s3Client, { runId, archivePath, archiveFilename, summaryPath, summaryFilename, expectedSha256 }) {
  const archiveResult = await uploadAndVerifyOne(s3Client, {
    localPath: archivePath,
    remoteKey: `${runId}/${archiveFilename}`,
    expectedSha256,
  })
  const summaryBytes = await readFile(summaryPath)
  await s3Client.putObject(`${runId}/${summaryFilename}`, summaryBytes, { ifNoneMatch: '*' })
  const downloadedSummary = await s3Client.getObject(`${runId}/${summaryFilename}`)
  const summaryVerified = downloadedSummary !== null && downloadedSummary.equals(summaryBytes)

  return {
    uploaded: true,
    verified: archiveResult.verified && summaryVerified,
    reason: !archiveResult.verified ? archiveResult.reason : !summaryVerified ? 'summary manifest did not round-trip correctly' : undefined,
  }
}

export async function runBackup({
  runId = process.env.SNAPSHOT_RUN_ID ?? generateRunId(),
  stagingBaseDir = process.env.SNAPSHOT_STAGING_DIR ?? tmpdir(),
  recipients = (process.env.AGE_RECIPIENTS ?? '').split(',').filter(Boolean),
  r2Config = {
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
  },
  healthcheckPingUrl = process.env.HEALTHCHECKS_PING_URL,
  pgEnv,
  supabaseUrl = process.env.SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  dockerContainer = process.env.PG_EXPORT_DOCKER_CONTAINER,
  storageClient,
  s3Client,
} = {}) {
  const healthcheck = createHealthcheckClient({ pingUrl: healthcheckPingUrl })
  await healthcheck.start()

  const result = {
    runId,
    createdAt: new Date().toISOString(),
    postgres: { completeness: 'FAILED' },
    storage: { completeness: 'FAILED' },
  }

  // Everything that can fail before either leg has even started - including
  // building the S3 client itself, e.g. from an incomplete r2Config - is
  // now inside this try/catch/finally too. Found by independent review:
  // with createS3Client()/mkdtemp() both outside the try, a bad R2 config
  // threw straight past the finally, leaking the staging directory and
  // skipping the /fail healthcheck ping every other failure path already
  // sends. Caught here and folded into the same "record it, ping fail,
  // return a result" contract every leg failure already follows, rather
  // than this one case alone being allowed to throw out of the function.
  let stagingDir
  try {
    stagingDir = await mkdtemp(path.join(stagingBaseDir, 'habitex-backup-run-'))
    const s3 = s3Client ?? createS3Client(r2Config)

    try {
      const pgResult = await runPostgresExport({
        pgEnv,
        outputDir: stagingDir,
        recipients,
        runId,
        dockerContainer,
      })
      const upload = await uploadAndVerify(s3, {
        runId,
        archivePath: pgResult.archivePath,
        archiveFilename: pgResult.summary.archiveFilename,
        summaryPath: pgResult.summaryPath,
        summaryFilename: path.basename(pgResult.summaryPath),
        expectedSha256: pgResult.summary.archiveSha256,
      })
      result.postgres = { ...pgResult.summary, ...upload }
    } catch (cause) {
      result.postgres = { completeness: 'FAILED', error: cause.message, errorType: cause.constructor.name }
    }

    try {
      const storageResult = await runStorageExport({
        supabaseUrl,
        serviceRoleKey,
        outputDir: stagingDir,
        recipients,
        runId,
        client: storageClient,
      })
      const upload = await uploadAndVerify(s3, {
        runId,
        archivePath: storageResult.archivePath,
        archiveFilename: storageResult.summary.archiveFilename,
        summaryPath: storageResult.summaryPath,
        summaryFilename: path.basename(storageResult.summaryPath),
        expectedSha256: storageResult.summary.archiveSha256,
      })
      result.storage = { ...storageResult.summary, ...upload }
    } catch (cause) {
      result.storage = { completeness: 'FAILED', error: cause.message, errorType: cause.constructor.name }
    }

    result.completeness = computeCombinedCompleteness(result)
  } catch (cause) {
    result.error = cause.message
    result.errorType = cause.constructor.name
    result.completeness = 'FAILED'
  } finally {
    if (stagingDir) {
      await rm(stagingDir, { recursive: true, force: true })
    }
  }

  if (result.completeness === 'COMPLETE') {
    await healthcheck.success(toHealthcheckPayload(result))
  } else {
    await healthcheck.fail(toHealthcheckPayload(result))
  }

  return result
}

export function computeCombinedCompleteness(result) {
  const pgOk = result.postgres.completeness === 'COMPLETE' && result.postgres.verified === true
  const storageOk = result.storage.completeness === 'COMPLETE' && result.storage.verified === true
  if (pgOk && storageOk) {
    return 'COMPLETE'
  }
  const pgRanAtAll = result.postgres.completeness !== 'FAILED'
  const storageRanAtAll = result.storage.completeness !== 'FAILED'
  if (!pgRanAtAll || !storageRanAtAll) {
    return 'FAILED'
  }
  // Both legs produced something and uploaded, but at least one is
  // incomplete (e.g. Storage had missing objects) or failed verification -
  // the run is real but not safe to call COMPLETE.
  return 'PARTIAL'
}

async function main() {
  const result = await runBackup()
  console.log(JSON.stringify(result, null, 2))
  if (result.completeness !== 'COMPLETE') {
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message)
    process.exitCode = 1
  })
}
