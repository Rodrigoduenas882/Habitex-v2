#!/usr/bin/env node
// Tests scripts/backup/recover-from-destination.mjs against a local mock
// R2 server with hand-built, valid encrypted artifacts - no live Supabase
// stack or Docker needed, just `age`/`age-keygen` on PATH.
//
// Run manually: node scripts/backup/test-recover-from-destination.mjs

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, rm, readFile, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { startMockR2Server } from './shared/mock-r2-server.mjs'
import { createS3Client } from './shared/s3-client.mjs'
import { encryptBuffer, sha256 } from './shared/age-helpers.mjs'
import { packDirectory } from './storage/pack.mjs'
import { recoverFromDestination } from './recover-from-destination.mjs'

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
  const dir = await mkdtemp(path.join(tmpdir(), 'habitex-recover-test-'))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** Uploads a complete, valid, hand-built snapshot (both legs) for `runId`, returning the recipients' identity path. */
async function seedValidSnapshot(mock, root, runId, { corruptStoragePackIndex = false } = {}) {
  const s3 = createS3Client({ endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: mock.secretAccessKey, bucket: mock.bucket })
  await mkdir(root, { recursive: true })
  const id1 = path.join(root, 'id1.txt')
  await execFileAsync('age-keygen', ['-o', id1])
  const pub = (await readFile(id1, 'utf8')).match(/public key: (age1\w+)/)[1]
  const recipients = [pub, pub] // same identity twice is fine for a test fixture

  const pgPlaintext = Buffer.from('SET session_replication_role = replica;\nSELECT 1;\nRESET ALL;\n')
  const pgArchive = await encryptBuffer(pgPlaintext, recipients)
  await s3.putObject(`${runId}/${runId}.postgres.sql.age`, pgArchive)
  await s3.putObject(
    `${runId}/${runId}.postgres-manifest-summary.json`,
    Buffer.from(JSON.stringify({ archiveFilename: `${runId}.postgres.sql.age`, archiveSha256: sha256(pgArchive), completeness: 'COMPLETE' })),
  )

  const stagingDir = path.join(root, 'storage-staging')
  await mkdir(path.join(stagingDir, 'objects', 'receipts', 'admin-1'), { recursive: true })
  await writeFile(path.join(stagingDir, 'objects', 'receipts', 'admin-1', 'file.pdf'), Buffer.from('fixture receipt'))
  await writeFile(
    path.join(stagingDir, 'manifest.json'),
    JSON.stringify({ runId, objects: [{ bucket: 'receipts', path: 'admin-1/file.pdf', status: 'DOWNLOADED', sha256: sha256(Buffer.from('fixture receipt')) }] }),
  )
  let storagePacked = await packDirectory(stagingDir)
  if (corruptStoragePackIndex) {
    // Flip a byte inside the JSON index region (right after the 4-byte
    // length header) so JSON.parse on it throws - simulates a corrupted
    // pack arriving intact through decryption (a valid ciphertext whose
    // plaintext payload is itself malformed), not a decryption failure.
    storagePacked[4] = 0x00
  }
  const storageArchive = await encryptBuffer(storagePacked, recipients)
  await s3.putObject(`${runId}/${runId}.snapshot.age`, storageArchive)
  await s3.putObject(
    `${runId}/${runId}.manifest-summary.json`,
    Buffer.from(JSON.stringify({ archiveFilename: `${runId}.snapshot.age`, archiveSha256: sha256(storageArchive), completeness: 'COMPLETE' })),
  )

  return { identityPath: id1 }
}

async function main() {
  await withTempDir(async (root) => {
    await test('happy path: recovers both legs\' plaintext bytes correctly', async () => {
      const mock = await startMockR2Server()
      try {
        const { identityPath } = await seedValidSnapshot(mock, path.join(root, 'seed-happy'), 'happy-run')
        const outputDir = path.join(root, 'recovered-happy')
        const r2Config = { endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: mock.secretAccessKey, bucket: mock.bucket }
        const result = await recoverFromDestination({ runId: 'happy-run', identityPath, outputDir, r2Config })

        const pgSql = await readFile(result.postgresSqlPath, 'utf8')
        assert(pgSql.includes('SELECT 1;'), 'recovered postgres SQL does not match what was archived')
        const receipt = await readFile(path.join(result.storageOutputDir, 'objects', 'receipts', 'admin-1', 'file.pdf'), 'utf8')
        assert(receipt === 'fixture receipt', 'recovered storage object content does not match what was archived')
      } finally {
        await mock.close()
      }
    })

    await test('regression (LOW, independent review): a failure partway through unpacking renames outputDir aside instead of leaving a silent partial mix', async () => {
      const mock = await startMockR2Server()
      try {
        const { identityPath } = await seedValidSnapshot(mock, path.join(root, 'seed-corrupt'), 'corrupt-run', { corruptStoragePackIndex: true })
        const outputDir = path.join(root, 'recovered-corrupt')
        const r2Config = { endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: mock.secretAccessKey, bucket: mock.bucket }

        let threw = false
        try {
          await recoverFromDestination({ runId: 'corrupt-run', identityPath, outputDir, r2Config })
        } catch {
          threw = true
        }
        assert(threw, 'expected recoverFromDestination to throw when the storage pack index is corrupted')
        assert(!existsSync(outputDir), 'outputDir should have been renamed aside, not left in place')

        const siblings = await readdir(root)
        const partialDirs = siblings.filter((name) => name.startsWith('recovered-corrupt.partial-'))
        assert(partialDirs.length === 1, `expected exactly one renamed .partial-* directory, found: ${partialDirs.join(', ')}`)
        // The postgres leg's bytes, written before the failure, must still
        // be present under the renamed directory - nothing silently lost.
        const partialPgSqlPath = path.join(root, partialDirs[0], 'corrupt-run.postgres.sql')
        assert(existsSync(partialPgSqlPath), 'the postgres SQL written before the failure should be preserved under the .partial directory')
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
