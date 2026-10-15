#!/usr/bin/env node
// Standalone integration test suite for the Storage backup pipeline
// (INC-BKP-003). Not part of `pnpm test` - like scripts/e2e-local-seed.mjs,
// this needs a live local Supabase stack (`pnpm exec supabase start`) plus
// the `age` CLI on PATH, neither of which the main Vitest suite's
// environment provides or should be made to depend on. Run manually:
//
//   SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_SERVICE_ROLE_KEY=<local service_role key from `supabase status`> \
//   node scripts/backup/storage/test-storage-snapshot.mjs
//
// Covers the full acceptance criterion (export -> recover -> verify
// integrity -> a second run never touches the first snapshot) plus the 4
// required negative tests (missing object, corruption, collision,
// encryption failure) and 2 additional ones added after independent review:
// decryption with a non-recipient identity, and the zip-slip/path-traversal
// regression for the BLOCKER finding fixed in pack.mjs.

import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  runExport,
  generateRunId,
  SnapshotCollisionError,
  EncryptionFailedError,
} from './export-storage-snapshot.mjs'
import { runRestore, ArchiveCorruptedError, DecryptionFailedError, UnsafeArchiveEntryError } from './restore-storage-snapshot.mjs'
import { createStorageClient } from './storage-client.mjs'

/** Builds a pack.mjs-format buffer by hand, for crafting a malicious entry a real packDirectory() call never would. */
function buildRawPack(entries) {
  const index = entries.map(({ path: entryPath, bytes }) => ({ path: entryPath, size: bytes.length }))
  const indexBytes = Buffer.from(JSON.stringify(index), 'utf8')
  const header = Buffer.alloc(4)
  header.writeUInt32BE(indexBytes.length, 0)
  return Buffer.concat([header, indexBytes, ...entries.map((e) => e.bytes)])
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(2)
}

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

async function withTempDirs(fn) {
  const root = await mkdtemp(path.join(tmpdir(), 'habitex-storage-test-'))
  try {
    return await fn(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

/**
 * Regression test for the HIGH finding (pagination): listOne must keep
 * paging until a page comes back short of the page size, not stop after
 * one call. Mocks `fetch` rather than uploading 1000+ real objects (slow,
 * and the point under test is the loop's own termination condition, not
 * anything about real Storage behavior - already covered by the live
 * happy-path test elsewhere in this suite).
 */
async function testPagination() {
  const originalFetch = globalThis.fetch
  const callOffsets = []
  try {
    globalThis.fetch = async (url, init) => {
      const { offset, limit } = JSON.parse(init.body)
      callOffsets.push(offset)
      const remaining = 1001 - offset
      const pageSize = Math.min(limit, Math.max(remaining, 0))
      const page = Array.from({ length: pageSize }, (_, i) => ({
        name: `object-${offset + i}.pdf`,
        id: `id-${offset + i}`,
        updated_at: '2026-01-01T00:00:00Z',
        metadata: { size: 1, mimetype: 'application/pdf', eTag: '"x"' },
      }))
      return { ok: true, status: 200, json: async () => page }
    }
    const client = createStorageClient({ url: 'http://mock', serviceRoleKey: 'mock-key' })
    const objects = await client.listAllObjects('receipts')
    assert(objects.length === 1001, `expected all 1001 objects across pages, got ${objects.length}`)
    assert(callOffsets.length >= 2, `expected at least 2 paginated calls, got ${callOffsets.length}`)
    assert(callOffsets.includes(1000), 'expected a second page fetched at offset 1000')
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function uploadTestObject(client, bucket, body, mimeType = 'application/pdf') {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${bucket}`
  const administrationId = randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
  const objectPath = `${administrationId}/${randomBytes(16).toString('hex')}`
  const res = await fetch(`${url}/${objectPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': mimeType,
    },
    body,
  })
  if (!res.ok) throw new Error(`test upload failed: ${res.status} ${await res.text()}`)
  return objectPath
}

async function main() {
  // Two throwaway age identities, generated fresh for this test run only -
  // never a real recovery key, per this increment's own restriction.
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const execFileAsync = promisify(execFile)

  await withTempDirs(async (root) => {
    const id1 = path.join(root, 'identity1.txt')
    const id2 = path.join(root, 'identity2.txt')
    await execFileAsync('age-keygen', ['-o', id1])
    await execFileAsync('age-keygen', ['-o', id2])
    const pub1 = (await readFile(id1, 'utf8')).match(/public key: (age1\w+)/)[1]
    const pub2 = (await readFile(id2, 'utf8')).match(/public key: (age1\w+)/)[1]

    const client = createStorageClient({ url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY })
    const snapshotsDir = path.join(root, 'snapshots')

    let happyPathArchive
    let happyPathSummary

    await test('export -> restore -> full integrity verification (happy path)', async () => {
      const uploadedPath = await uploadTestObject(client, 'receipts', Buffer.from('test receipt content'))
      const result = await runExport({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SERVICE_ROLE_KEY,
        outputDir: snapshotsDir,
        recipients: [pub1, pub2],
      })
      assert(result.summary.completeness === 'COMPLETE', 'expected COMPLETE')
      assert(result.summary.downloadedCount >= 1, 'expected at least 1 downloaded object')
      happyPathArchive = result.archivePath
      happyPathSummary = result.summaryPath

      const outputDir = path.join(root, 'restore-happy')
      const restoreResult = await runRestore({ archivePath: happyPathArchive, identityPath: id1, outputDir })
      assert(restoreResult.restoreStatus === 'VERIFIED', `expected VERIFIED, got ${restoreResult.restoreStatus}`)
      assert(
        restoreResult.archiveChecksumLayer === 'VERIFIED',
        `expected archiveChecksumLayer VERIFIED when a summary is present, got ${restoreResult.archiveChecksumLayer}`,
      )
      const found = restoreResult.verification.find((v) => v.path === uploadedPath)
      assert(found && found.result === 'MATCH', 'uploaded test object did not round-trip with a matching checksum')

      // Second recipient must independently decrypt the same archive.
      const restoreResult2 = await runRestore({
        archivePath: happyPathArchive,
        identityPath: id2,
        outputDir: path.join(root, 'restore-happy-2'),
      })
      assert(restoreResult2.restoreStatus === 'VERIFIED', 'second independent recipient failed to decrypt')
    })

    await test('regression (HIGH): a missing summary manifest is reported as SKIPPED, not silently indistinguishable from VERIFIED', async () => {
      const restoreResult = await runRestore({
        archivePath: happyPathArchive,
        summaryPath: path.join(root, 'no-such-summary.json'),
        identityPath: id1,
        outputDir: path.join(root, 'restore-no-summary'),
      })
      assert(
        restoreResult.archiveChecksumLayer === 'SKIPPED_NO_SUMMARY',
        `expected SKIPPED_NO_SUMMARY, got ${restoreResult.archiveChecksumLayer}`,
      )
      // The object-level layer still ran and still passed - this restore is
      // legitimately fine, just with one fewer verification layer, and the
      // result must say so rather than hide it.
      assert(restoreResult.restoreStatus === 'VERIFIED', 'object-level verification should still pass on its own')
    })

    await test('regression (HIGH): Storage list pagination does not silently truncate at 1000 objects', testPagination)

    await test('a second run never touches or alters the first snapshot (acceptance criterion)', async () => {
      const beforeBytes = await readFile(happyPathArchive)
      await uploadTestObject(client, 'documents', Buffer.from('a second, unrelated object'))
      const second = await runExport({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SERVICE_ROLE_KEY,
        outputDir: snapshotsDir,
        recipients: [pub1, pub2],
      })
      const afterBytes = await readFile(happyPathArchive)
      assert(Buffer.compare(beforeBytes, afterBytes) === 0, 'first snapshot archive was modified by a later run')
      assert(second.archivePath !== happyPathArchive, 'second run reused the first run\'s archive path')
    })

    await test('negative: collision - re-running with an existing run id is refused, not overwritten', async () => {
      const fixedRunId = generateRunId()
      await runExport({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SERVICE_ROLE_KEY,
        outputDir: snapshotsDir,
        recipients: [pub1, pub2],
        runId: fixedRunId,
      })
      const archivePath = path.join(snapshotsDir, `${fixedRunId}.snapshot.age`)
      const beforeBytes = await readFile(archivePath)
      let threw = false
      try {
        await runExport({
          supabaseUrl: SUPABASE_URL,
          serviceRoleKey: SERVICE_ROLE_KEY,
          outputDir: snapshotsDir,
          recipients: [pub1, pub2],
          runId: fixedRunId,
        })
      } catch (err) {
        threw = err instanceof SnapshotCollisionError
      }
      assert(threw, 'expected a SnapshotCollisionError on a repeated run id')
      const afterBytes = await readFile(archivePath)
      assert(Buffer.compare(beforeBytes, afterBytes) === 0, 'colliding run altered the pre-existing snapshot')
    })

    await test('negative: missing object - the full export pipeline marks a vanished object PARTIAL, not silently dropped', async () => {
      // Deterministically simulates the real "listed, then gone before
      // download" race (rather than trying to win a timing race against a
      // real delete) by wrapping the real client and making exactly one
      // known-real path 404 on download, as if it had just been removed.
      const realObjects = await client.listAllObjects('receipts')
      assert(realObjects.length > 0, 'test setup: expected at least one real object in receipts to simulate going missing')
      const vanishingPath = realObjects[0].path
      const flakyClient = {
        listAllObjects: (bucket) => client.listAllObjects(bucket),
        downloadObject: (bucket, objectPath) =>
          objectPath === vanishingPath ? Promise.resolve(null) : client.downloadObject(bucket, objectPath),
      }

      const result = await runExport({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SERVICE_ROLE_KEY,
        outputDir: snapshotsDir,
        recipients: [pub1, pub2],
        client: flakyClient,
      })

      assert(result.summary.completeness === 'PARTIAL', `expected PARTIAL, got ${result.summary.completeness}`)
      assert(result.summary.missingCount === 1, `expected exactly 1 missing object, got ${result.summary.missingCount}`)
      const missingEntry = result.manifest.objects.find((o) => o.path === vanishingPath)
      assert(missingEntry?.status === 'MISSING', 'the vanished object was not recorded as MISSING in the manifest')

      const restoreResult = await runRestore({
        archivePath: result.archivePath,
        identityPath: id1,
        outputDir: path.join(root, 'restore-partial'),
      })
      const skipped = restoreResult.verification.find((v) => v.path === vanishingPath)
      assert(
        skipped?.result === 'SKIPPED_MISSING_AT_BACKUP_TIME',
        'restore did not correctly carry forward the missing-at-backup-time status',
      )
    })

    await test('negative: corruption - a tampered archive is caught by checksum before decryption', async () => {
      const summary = JSON.parse(await readFile(happyPathSummary, 'utf8'))
      const corruptedPath = path.join(root, 'corrupted.snapshot.age')
      const original = await readFile(happyPathArchive)
      const tampered = Buffer.from(original)
      tampered[Math.floor(tampered.length / 2)] ^= 0xff
      await writeFile(corruptedPath, tampered)
      const corruptedSummaryPath = path.join(root, 'corrupted.manifest-summary.json')
      await writeFile(corruptedSummaryPath, JSON.stringify(summary))

      let threw = false
      try {
        await runRestore({
          archivePath: corruptedPath,
          summaryPath: corruptedSummaryPath,
          identityPath: id1,
          outputDir: path.join(root, 'restore-corrupted'),
        })
      } catch (err) {
        threw = err instanceof ArchiveCorruptedError
      }
      assert(threw, 'expected an ArchiveCorruptedError for a tampered archive')
    })

    await test('negative: decryption failure - the wrong identity is rejected, not silently given garbage', async () => {
      await withTempDirs(async (wrongRoot) => {
        const wrongId = path.join(wrongRoot, 'wrong-identity.txt')
        await execFileAsync('age-keygen', ['-o', wrongId])
        let threw = false
        try {
          await runRestore({
            archivePath: happyPathArchive,
            identityPath: wrongId,
            outputDir: path.join(root, 'restore-wrong-identity'),
          })
        } catch (err) {
          threw = err instanceof DecryptionFailedError
        }
        assert(threw, 'expected a DecryptionFailedError for an identity not among the snapshot\'s recipients')
      })
    })

    await test('negative: zip-slip - a malicious archive entry path cannot write outside outputDir', async () => {
      const maliciousPack = buildRawPack([
        { path: 'manifest.json', bytes: Buffer.from(JSON.stringify({ runId: 'malicious', objects: [] })) },
        { path: '../../zipslip-marker.txt', bytes: Buffer.from('should never be written') },
      ])
      const maliciousArchivePath = path.join(root, 'malicious.snapshot.age')
      const encrypted = await new Promise((resolve, reject) => {
        const child = spawn('age', ['-r', pub1], { shell: false })
        const chunks = []
        child.stdout.on('data', (c) => chunks.push(c))
        child.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error('age failed'))))
        child.stdin.write(maliciousPack)
        child.stdin.end()
      })
      await writeFile(maliciousArchivePath, encrypted)

      const restoreOutputDir = path.join(root, 'restore-zipslip')
      // What the malicious '../../zipslip-marker.txt' entry resolves to
      // relative to restoreOutputDir, if the guard failed to stop it -
      // cleaned up defensively; the fix should mean this is never created.
      const markerOutsidePath = path.resolve(restoreOutputDir, '..', '..', 'zipslip-marker.txt')
      let threw = false
      try {
        await runRestore({
          archivePath: maliciousArchivePath,
          summaryPath: path.join(root, 'does-not-exist.manifest-summary.json'),
          identityPath: id1,
          outputDir: restoreOutputDir,
        })
      } catch (err) {
        threw = err instanceof UnsafeArchiveEntryError
      } finally {
        await rm(markerOutsidePath, { force: true })
      }
      assert(threw, 'expected an UnsafeArchiveEntryError for a path-traversal entry, restore must not silently report VERIFIED')
    })

    await test('negative: encryption failure - a malformed recipient aborts cleanly, no plaintext or partial artifact left', async () => {
      const runId = generateRunId()
      let threw = false
      try {
        await runExport({
          supabaseUrl: SUPABASE_URL,
          serviceRoleKey: SERVICE_ROLE_KEY,
          outputDir: snapshotsDir,
          recipients: [pub1, 'not-a-valid-age-recipient'],
          runId,
        })
      } catch (err) {
        threw = err instanceof EncryptionFailedError
      }
      assert(threw, 'expected an EncryptionFailedError for a malformed recipient')
      const { existsSync } = await import('node:fs')
      assert(!existsSync(path.join(snapshotsDir, `${runId}.snapshot.age`)), 'a partial/corrupt archive was left behind after encryption failure')
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
