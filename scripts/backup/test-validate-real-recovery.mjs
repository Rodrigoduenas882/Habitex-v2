#!/usr/bin/env node
// Tests scripts/backup/validate-real-recovery.mjs against a local mock R2
// server with hand-built, valid encrypted artifacts - no live Supabase
// stack, Docker, or real R2/age production identity needed, just
// `age`/`age-keygen` on PATH. Never touches the real production run id or
// the real age identities - this is a throwaway fixture identity, same
// pattern as test-recover-from-destination.mjs.
//
// Run manually: node scripts/backup/test-validate-real-recovery.mjs

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { startMockR2Server } from './shared/mock-r2-server.mjs'
import { createS3Client } from './shared/s3-client.mjs'
import { encryptBuffer, sha256 } from './shared/age-helpers.mjs'
import { packDirectory } from './storage/pack.mjs'
import { validateRealRecovery, crossCheckHashes } from './validate-real-recovery.mjs'

const execFileAsync = promisify(execFile)

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

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'habitex-validate-recovery-test-'))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** Uploads a complete, valid, hand-built snapshot (both legs) for `runId`, returning the identity path and both archives' real sha256 for cross-check assertions. */
async function seedValidSnapshot(root, runId) {
  await mkdir(root, { recursive: true })
  const id1 = path.join(root, 'id1.txt')
  await execFileAsync('age-keygen', ['-o', id1])
  const pub = (await readFile(id1, 'utf8')).match(/public key: (age1\w+)/)[1]
  const recipients = [pub, pub]

  const pgPlaintext = Buffer.from('SET session_replication_role = replica;\nSELECT 1;\nRESET ALL;\n')
  const pgArchive = await encryptBuffer(pgPlaintext, recipients)
  const pgArchiveSha256 = sha256(pgArchive)

  const stagingDir = path.join(root, 'storage-staging')
  const objectBytes = Buffer.from('fixture receipt')
  await mkdir(path.join(stagingDir, 'objects', 'receipts', 'admin-1'), { recursive: true })
  await writeFile(path.join(stagingDir, 'objects', 'receipts', 'admin-1', 'file.pdf'), objectBytes)
  await writeFile(
    path.join(stagingDir, 'manifest.json'),
    JSON.stringify({ runId, objects: [{ bucket: 'receipts', path: 'admin-1/file.pdf', status: 'DOWNLOADED', sha256: sha256(objectBytes) }] }),
  )
  const storagePacked = await packDirectory(stagingDir)
  const storageArchive = await encryptBuffer(storagePacked, recipients)
  const storageArchiveSha256 = sha256(storageArchive)

  return { identityPath: id1, pgArchive, pgArchiveSha256, storageArchive, storageArchiveSha256 }
}

async function main() {
  await withTempDir(async (root) => {
    await test('crossCheckHashes: all sources agreeing -> match true', () => {
      const result = crossCheckHashes('postgres', { summaryRecorded: 'abc', recomputedFromDownload: 'ABC', externallyReported: 'abc' })
      assert(result.match === true, 'expected match true when all sources agree (case-insensitively)')
    })

    await test('crossCheckHashes: a disagreeing externally-reported hash -> match false', () => {
      const result = crossCheckHashes('postgres', { summaryRecorded: 'abc', recomputedFromDownload: 'abc', externallyReported: 'def' })
      assert(result.match === false, 'expected match false when externallyReported disagrees')
    })

    await test('crossCheckHashes: externallyReported omitted (null) -> compares only the present sources', () => {
      const result = crossCheckHashes('postgres', { summaryRecorded: 'abc', recomputedFromDownload: 'abc', externallyReported: null })
      assert(result.match === true, 'expected match true when the only present sources agree')
      assert(!('externallyReported' in result.sources), 'a null source should not appear in the reported sources')
    })

    await test('happy path: validateRealRecovery cross-checks hashes, decrypts postgres, and verifies storage end-to-end', async () => {
      const mock = await startMockR2Server()
      try {
        const runId = 'real-recovery-happy'
        const seed = await seedValidSnapshot(path.join(root, 'seed-happy'), runId)
        const s3 = createS3Client({ endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: mock.secretAccessKey, bucket: mock.bucket })
        await s3.putObject(`${runId}/${runId}.postgres.sql.age`, seed.pgArchive)
        await s3.putObject(
          `${runId}/${runId}.postgres-manifest-summary.json`,
          Buffer.from(JSON.stringify({ archiveFilename: `${runId}.postgres.sql.age`, archiveSha256: seed.pgArchiveSha256, completeness: 'COMPLETE' })),
        )
        await s3.putObject(`${runId}/${runId}.snapshot.age`, seed.storageArchive)
        await s3.putObject(
          `${runId}/${runId}.manifest-summary.json`,
          Buffer.from(JSON.stringify({ archiveFilename: `${runId}.snapshot.age`, archiveSha256: seed.storageArchiveSha256, completeness: 'COMPLETE' })),
        )

        const outputDir = path.join(root, 'recovered-happy')
        const r2Config = { endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: mock.secretAccessKey, bucket: mock.bucket }
        const result = await validateRealRecovery({
          runId,
          identityPath: seed.identityPath,
          outputDir,
          expectedPostgresSha256: seed.pgArchiveSha256,
          expectedStorageSha256: seed.storageArchiveSha256,
          r2Config,
        })

        assert(result.postgresCrossCheck.match === true, 'expected postgres hash cross-check to match')
        assert(result.storageCrossCheck.match === true, 'expected storage hash cross-check to match')
        const pgSql = await readFile(result.postgresSqlPath, 'utf8')
        assert(pgSql.includes('SELECT 1;'), 'recovered postgres SQL does not match what was archived')
        assert(result.storageResult.restoreStatus === 'VERIFIED', 'expected storage restoreStatus VERIFIED')
        assert(result.storageResult.verification[0].result === 'MATCH', 'expected the single storage object to MATCH')
      } finally {
        await mock.close()
      }
    })

    await test('regression: a wrong externally-reported hash is caught even though the snapshot itself is valid and eligible', async () => {
      const mock = await startMockR2Server()
      try {
        const runId = 'real-recovery-wrong-expected'
        const seed = await seedValidSnapshot(path.join(root, 'seed-wrong-expected'), runId)
        const s3 = createS3Client({ endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: mock.secretAccessKey, bucket: mock.bucket })
        await s3.putObject(`${runId}/${runId}.postgres.sql.age`, seed.pgArchive)
        await s3.putObject(
          `${runId}/${runId}.postgres-manifest-summary.json`,
          Buffer.from(JSON.stringify({ archiveFilename: `${runId}.postgres.sql.age`, archiveSha256: seed.pgArchiveSha256, completeness: 'COMPLETE' })),
        )
        await s3.putObject(`${runId}/${runId}.snapshot.age`, seed.storageArchive)
        await s3.putObject(
          `${runId}/${runId}.manifest-summary.json`,
          Buffer.from(JSON.stringify({ archiveFilename: `${runId}.snapshot.age`, archiveSha256: seed.storageArchiveSha256, completeness: 'COMPLETE' })),
        )

        const outputDir = path.join(root, 'recovered-wrong-expected')
        const r2Config = { endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: mock.secretAccessKey, bucket: mock.bucket }
        const result = await validateRealRecovery({
          runId,
          identityPath: seed.identityPath,
          outputDir,
          // Deliberately wrong - simulates a human mistyping/mis-copying the
          // hash reported from the GitHub Actions run into this drill.
          expectedPostgresSha256: 'f'.repeat(64),
          expectedStorageSha256: seed.storageArchiveSha256,
          r2Config,
        })

        assert(result.postgresCrossCheck.match === false, 'expected postgres hash cross-check to fail on a wrong externally-reported hash')
        assert(result.storageCrossCheck.match === true, 'storage leg was not tampered with and should still match')
      } finally {
        await mock.close()
      }
    })
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
