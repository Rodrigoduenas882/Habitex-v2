#!/usr/bin/env node
// Tests shared/select-snapshot.mjs (INC-BKP-005 step 8) against the
// standalone mock R2 server already populated by this session's real
// run-backup.mjs invocation, plus deliberately-corrupted variants
// constructed directly against the same server. No live Supabase stack
// needed for this file specifically - only an S3-compatible endpoint.
//
// Run manually:
//   R2_ENDPOINT=http://127.0.0.1:<port> R2_ACCESS_KEY_ID=... \
//   R2_SECRET_ACCESS_KEY=... R2_BUCKET=... REAL_RUN_ID=<runId> \
//   node scripts/backup/test-select-snapshot.mjs

import { createS3Client } from './shared/s3-client.mjs'
import { selectSnapshotForRestore, SnapshotNotEligibleError } from './shared/select-snapshot.mjs'

const endpoint = process.env.R2_ENDPOINT
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucket = process.env.R2_BUCKET
const realRunId = process.env.REAL_RUN_ID
if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !realRunId) {
  console.error('R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, REAL_RUN_ID are required')
  process.exit(2)
}

const s3 = createS3Client({ endpoint, accessKeyId, secretAccessKey, bucket })

const results = []
async function test(name, fn) {
  try {
    await fn()
    results.push({ name, pass: true })
    console.log(`PASS  ${name}`)
  } catch (err) {
    results.push({ name, pass: false, error: err.message })
    console.log(`FAIL  ${name}: ${err.message}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message ?? 'assertion failed')
}

async function main() {
  await test('a real, COMPLETE, uncorrupted snapshot is eligible for restore', async () => {
    const selection = await selectSnapshotForRestore(s3, realRunId)
    assert(selection.postgres.summary.completeness === 'COMPLETE')
    assert(selection.storage.summary.completeness === 'COMPLETE')
  })

  await test('negative: a run id that never uploaded anything is rejected, not silently treated as empty-but-fine', async () => {
    let threw = false
    try {
      await selectSnapshotForRestore(s3, 'this-run-id-never-existed')
    } catch (err) {
      threw = err instanceof SnapshotNotEligibleError
    }
    assert(threw, 'expected SnapshotNotEligibleError for a nonexistent run id')
  })

  await test('negative: a summary reporting PARTIAL completeness is rejected', async () => {
    const fakeRunId = 'fake-partial-run'
    const postgresSummary = { archiveFilename: `${fakeRunId}.postgres.sql.age`, archiveSha256: 'irrelevant', completeness: 'COMPLETE' }
    const storageSummary = { archiveFilename: `${fakeRunId}.snapshot.age`, archiveSha256: 'irrelevant', completeness: 'PARTIAL' }
    await s3.putObject(`${fakeRunId}/${fakeRunId}.postgres-manifest-summary.json`, Buffer.from(JSON.stringify(postgresSummary)))
    await s3.putObject(`${fakeRunId}/${fakeRunId}.manifest-summary.json`, Buffer.from(JSON.stringify(storageSummary)))
    let threw = false
    let reasons = []
    try {
      await selectSnapshotForRestore(s3, fakeRunId)
    } catch (err) {
      threw = err instanceof SnapshotNotEligibleError
      reasons = err.reasons ?? []
    }
    assert(threw, 'expected rejection for a PARTIAL storage summary')
    assert(reasons.some((r) => r.includes('PARTIAL')), `expected a PARTIAL-related reason, got: ${reasons.join('; ')}`)
  })

  await test('negative: a tampered/corrupted archive (checksum mismatch) is rejected before any decryption attempt', async () => {
    const fakeRunId = 'fake-corrupted-run'
    const realBytes = Buffer.from('this is not really an age archive, just test content')
    const summary = {
      archiveFilename: `${fakeRunId}.postgres.sql.age`,
      archiveSha256: '0000000000000000000000000000000000000000000000000000000000000', // deliberately wrong
      completeness: 'COMPLETE',
    }
    await s3.putObject(`${fakeRunId}/${fakeRunId}.postgres.sql.age`, realBytes)
    await s3.putObject(`${fakeRunId}/${fakeRunId}.postgres-manifest-summary.json`, Buffer.from(JSON.stringify(summary)))
    // Storage leg left intentionally absent too - either reason alone
    // should already cause rejection; this exercises the postgres-side
    // checksum-mismatch reason specifically.
    let threw = false
    let reasons = []
    try {
      await selectSnapshotForRestore(s3, fakeRunId)
    } catch (err) {
      threw = err instanceof SnapshotNotEligibleError
      reasons = err.reasons ?? []
    }
    assert(threw, 'expected rejection for a checksum mismatch')
    assert(reasons.some((r) => r.includes('checksum mismatch')), `expected a checksum-mismatch reason, got: ${reasons.join('; ')}`)
  })

  await test('negative: a summary present but its referenced archive file missing is rejected', async () => {
    const fakeRunId = 'fake-missing-archive-run'
    const summary = { archiveFilename: `${fakeRunId}.postgres.sql.age`, archiveSha256: 'irrelevant', completeness: 'COMPLETE' }
    await s3.putObject(`${fakeRunId}/${fakeRunId}.postgres-manifest-summary.json`, Buffer.from(JSON.stringify(summary)))
    // Note: archive file itself deliberately never uploaded.
    let threw = false
    let reasons = []
    try {
      await selectSnapshotForRestore(s3, fakeRunId)
    } catch (err) {
      threw = err instanceof SnapshotNotEligibleError
      reasons = err.reasons ?? []
    }
    assert(threw, 'expected rejection when the archive file is missing')
    assert(reasons.some((r) => r.includes('missing at the destination')), `expected a missing-archive reason, got: ${reasons.join('; ')}`)
  })

  await test('regression (MEDIUM, independent review): a summary that parses to null/0/false gives a real reason, not "undefined"', async () => {
    const fakeRunId = 'fake-falsy-summary-run'
    // Valid JSON, but not an object - a plausible shape for a truncated
    // or corrupted upload, which is exactly the scenario this gate exists
    // to catch. Previously this produced a SnapshotNotEligibleError whose
    // message read literally "postgres: undefined; storage: undefined" -
    // technically still fail-closed (never eligible), but useless to an
    // operator trying to diagnose a real incident.
    await s3.putObject(`${fakeRunId}/${fakeRunId}.postgres-manifest-summary.json`, Buffer.from('null'))
    await s3.putObject(`${fakeRunId}/${fakeRunId}.manifest-summary.json`, Buffer.from('null'))
    let threw = false
    let reasons = []
    try {
      await selectSnapshotForRestore(s3, fakeRunId)
    } catch (err) {
      threw = err instanceof SnapshotNotEligibleError
      reasons = err.reasons ?? []
    }
    assert(threw, 'expected rejection for a summary that parses to null')
    assert(!reasons.some((r) => r.includes('undefined')), `expected a real reason, not a bare "undefined", got: ${reasons.join('; ')}`)
    assert(reasons.every((r) => r.includes('not an object')), `expected a "not an object" reason for both legs, got: ${reasons.join('; ')}`)
  })

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length > 0) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
