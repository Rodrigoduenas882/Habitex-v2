#!/usr/bin/env node
// Standalone integration test suite for the backup orchestrator
// (INC-BKP-004). Not part of `pnpm test` - same reasoning as
// storage/test-storage-snapshot.mjs: needs a live local Supabase stack,
// the `age` CLI, and (for the PostgreSQL leg on this Windows dev machine)
// Docker - see postgres/export-postgres-encrypted.mjs's own note on why.
// The R2 destination is always the in-process mock-r2-server.mjs here -
// this increment's restrictions forbid creating any real external
// bucket/account, so there is no "real R2" mode to fall back to; a real
// run would only ever change R2_ENDPOINT/credentials, never this script.
//
// Run manually:
//   SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_SERVICE_ROLE_KEY=<local service_role key> \
//   PG_EXPORT_DOCKER_CONTAINER=supabase_db_Habitex-v2 \
//   node scripts/backup/test-run-backup.mjs

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { startMockR2Server } from './shared/mock-r2-server.mjs'
import { toHealthcheckPayload } from './shared/healthcheck.mjs'
import { runBackup, computeCombinedCompleteness } from './run-backup.mjs'
import { createStorageClient } from './storage/storage-client.mjs'

const execFileAsync = promisify(execFile)

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PG_DOCKER_CONTAINER = process.env.PG_EXPORT_DOCKER_CONTAINER
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(2)
}

const PG_ENV = {
  PGHOST: process.env.PGHOST ?? '127.0.0.1',
  PGPORT: process.env.PGPORT ?? '5432',
  PGDATABASE: process.env.PGDATABASE ?? 'postgres',
  PGUSER: process.env.PGUSER ?? 'backup_reader',
  PGPASSWORD: process.env.PGPASSWORD,
}
if (!PG_ENV.PGPASSWORD) {
  console.error('PGPASSWORD (the local backup_reader test password) is required')
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

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'habitex-backup-orchestrator-test-'))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function main() {
  await withTempDir(async (root) => {
    const id1 = path.join(root, 'identity1.txt')
    const id2 = path.join(root, 'identity2.txt')
    await execFileAsync('age-keygen', ['-o', id1])
    await execFileAsync('age-keygen', ['-o', id2])
    const pub1 = (await readFile(id1, 'utf8')).match(/public key: (age1\w+)/)[1]
    const pub2 = (await readFile(id2, 'utf8')).match(/public key: (age1\w+)/)[1]
    const recipients = [pub1, pub2]

    const baseOptions = () => ({
      pgEnv: PG_ENV,
      dockerContainer: PG_DOCKER_CONTAINER,
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_ROLE_KEY,
      recipients,
    })

    await test('happy path: both legs share one run id, upload, verify, and combine to COMPLETE', async () => {
      const mock = await startMockR2Server()
      try {
        const result = await runBackup({
          ...baseOptions(),
          r2Config: { endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: mock.secretAccessKey, bucket: mock.bucket },
        })
        assert(result.postgres.runId === result.runId, 'postgres leg did not share the orchestrator run id')
        assert(result.storage.runId === result.runId, 'storage leg did not share the orchestrator run id')
        assert(result.postgres.uploaded === true && result.postgres.verified === true, 'postgres upload/verify failed')
        assert(result.storage.uploaded === true && result.storage.verified === true, 'storage upload/verify failed')
        assert(result.completeness === 'COMPLETE', `expected COMPLETE, got ${result.completeness}`)
        // 2 archives + 2 summary manifests - the summary upload was a real
        // gap found and fixed during INC-BKP-005's first genuine end-to-end
        // recovery attempt (shared/select-snapshot.mjs had nothing to read
        // without it); see docs/ops/disaster-recovery-validation-findings.md.
        assert(mock.objects.size === 4, `expected exactly 4 objects uploaded to R2 (2 archives + 2 summaries), got ${mock.objects.size}`)
        const keys = [...mock.objects.keys()]
        assert(keys.some((k) => k.endsWith('.postgres.sql.age')), 'missing postgres archive at destination')
        assert(keys.some((k) => k.endsWith('.postgres-manifest-summary.json')), 'missing postgres summary at destination')
        assert(keys.some((k) => k.endsWith('.snapshot.age')), 'missing storage archive at destination')
        assert(keys.some((k) => k.endsWith('.manifest-summary.json') && !k.includes('postgres')), 'missing storage summary at destination')
        for (const key of keys) {
          assert(key.startsWith(`${result.runId}/`), `uploaded key "${key}" was not namespaced under the shared run id`)
        }
      } finally {
        await mock.close()
      }
    })

    await test('negative: a missing Storage object (PARTIAL) prevents a COMPLETE combined manifest', async () => {
      const mock = await startMockR2Server()
      try {
        const realClient = createStorageClient({ url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY })
        const realObjects = await realClient.listAllObjects('receipts')
        assert(realObjects.length > 0, 'test setup: expected at least one real receipts object')
        const vanishingPath = realObjects[0].path
        const flakyClient = {
          listAllObjects: (bucket) => realClient.listAllObjects(bucket),
          downloadObject: (bucket, objectPath) =>
            objectPath === vanishingPath ? Promise.resolve(null) : realClient.downloadObject(bucket, objectPath),
        }
        const result = await runBackup({
          ...baseOptions(),
          storageClient: flakyClient,
          r2Config: { endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: mock.secretAccessKey, bucket: mock.bucket },
        })
        assert(result.storage.completeness === 'PARTIAL', `expected storage leg PARTIAL, got ${result.storage.completeness}`)
        assert(result.completeness === 'PARTIAL', `expected combined PARTIAL, got ${result.completeness}`)
      } finally {
        await mock.close()
      }
    })

    await test('negative: PostgreSQL leg failure (unreachable connection) is isolated, reported FAILED, never crashes the whole run', async () => {
      // NOT a bad-password test: this local Supabase stack's pg_hba.conf
      // uses trust auth for local connections (confirmed directly - even
      // a deliberately wrong PGPASSWORD is accepted), so a credential
      // failure cannot be reproduced against this environment. An
      // unreachable port is a real failure this environment CAN produce,
      // and exercises the exact same "leg throws, gets isolated and
      // recorded" code path. See docs/ops/backup-automation-findings.md
      // for the trust-auth finding itself.
      const mock = await startMockR2Server()
      try {
        const result = await runBackup({
          ...baseOptions(),
          pgEnv: { ...PG_ENV, PGPORT: '1' },
          r2Config: { endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: mock.secretAccessKey, bucket: mock.bucket },
        })
        assert(result.postgres.completeness === 'FAILED', `expected postgres leg FAILED, got ${result.postgres.completeness}`)
        assert(typeof result.postgres.error === 'string' && result.postgres.error.length > 0, 'expected an error message recorded for the failed leg')
        assert(result.completeness === 'FAILED', `expected combined FAILED, got ${result.completeness}`)
        // The Storage leg must still have run and uploaded on its own -
        // one leg failing must not prevent the other from completing.
        assert(result.storage.uploaded === true, 'storage leg should still have run independently of the postgres failure')
      } finally {
        await mock.close()
      }
    })

    await test('negative: post-upload corruption is caught by verify-after-upload, not silently reported COMPLETE', async () => {
      const mock = await startMockR2Server()
      try {
        // A client that corrupts bytes on the way back down - simulating
        // transport/storage corruption between PUT and the verifying GET.
        const corruptingS3Client = {
          async putObject(key, body, opts) {
            const { createS3Client } = await import('./shared/s3-client.mjs')
            const real = createS3Client({ endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: mock.secretAccessKey, bucket: mock.bucket })
            return real.putObject(key, body, opts)
          },
          async getObject(key) {
            const { createS3Client } = await import('./shared/s3-client.mjs')
            const real = createS3Client({ endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: mock.secretAccessKey, bucket: mock.bucket })
            const bytes = await real.getObject(key)
            if (bytes === null) return null
            const corrupted = Buffer.from(bytes)
            corrupted[0] ^= 0xff
            return corrupted
          },
        }
        const result = await runBackup({ ...baseOptions(), s3Client: corruptingS3Client })
        assert(result.postgres.uploaded === true && result.postgres.verified === false, 'expected postgres leg to detect corruption on verify')
        assert(result.storage.uploaded === true && result.storage.verified === false, 'expected storage leg to detect corruption on verify')
        assert(result.completeness !== 'COMPLETE', `a corrupted upload must never combine to COMPLETE, got ${result.completeness}`)
      } finally {
        await mock.close()
      }
    })

    await test('negative: collision at the destination (key already exists) is refused, not silently overwritten', async () => {
      const mock = await startMockR2Server()
      try {
        const fixedRunId = 'fixed-run-for-collision-test'
        // Pre-populate the destination with an object at exactly the key
        // the postgres leg would upload to, simulating a prior run (or an
        // attacker) having already written there.
        const { createS3Client } = await import('./shared/s3-client.mjs')
        const preExisting = createS3Client({ endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: mock.secretAccessKey, bucket: mock.bucket })
        await preExisting.putObject(`${fixedRunId}/${fixedRunId}.postgres.sql.age`, Buffer.from('pre-existing content'))

        const result = await runBackup({
          ...baseOptions(),
          runId: fixedRunId,
          r2Config: { endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: mock.secretAccessKey, bucket: mock.bucket },
        })
        assert(result.postgres.completeness === 'FAILED', `expected postgres leg FAILED on collision, got ${result.postgres.completeness}`)
        assert(result.postgres.errorType === 'R2CollisionError', `expected R2CollisionError, got ${result.postgres.errorType}`)
        const stillOriginal = await preExisting.getObject(`${fixedRunId}/${fixedRunId}.postgres.sql.age`)
        assert(stillOriginal.toString() === 'pre-existing content', 'the pre-existing object at the destination was overwritten')
      } finally {
        await mock.close()
      }
    })

    await test('healthcheck payload never includes paths, administration ids, or per-object checksums', async () => {
      const combinedSummary = {
        runId: 'test-run',
        completeness: 'COMPLETE',
        postgres: { completeness: 'COMPLETE', archiveSha256: 'should-not-appear' },
        storage: {
          completeness: 'COMPLETE',
          objectCount: 3,
          downloadedCount: 3,
          missingCount: 0,
          objects: [{ bucket: 'receipts', path: '11111111-aaaa/some-uuid.pdf', sha256: 'should-not-appear-either' }],
        },
      }
      const payload = toHealthcheckPayload(combinedSummary)
      const serialized = JSON.stringify(payload)
      assert(!serialized.includes('should-not-appear'), 'healthcheck payload leaked a checksum field')
      assert(!serialized.includes('11111111-aaaa'), 'healthcheck payload leaked an administration-id-shaped path')
      assert(!('objects' in payload.storage), 'healthcheck payload must never carry the per-object list')
      assert(payload.runId === 'test-run' && payload.completeness === 'COMPLETE', 'aggregate fields should still be present')
    })

    await test('regression (MEDIUM, independent review): a bad R2 config fails gracefully, with no leaked staging dir and no uncaught throw', async () => {
      // Previously createS3Client()/mkdtemp() ran outside the try/finally,
      // so a config error here threw straight out of runBackup(), skipping
      // the /fail healthcheck ping every other failure path sends, and
      // leaking the just-created staging directory.
      const { readdir } = await import('node:fs/promises')
      const before = new Set(await readdir(tmpdir()))
      const result = await runBackup({ r2Config: {} })
      assert(result.completeness === 'FAILED', `expected FAILED, got ${result.completeness}`)
      assert(typeof result.error === 'string' && result.error.length > 0, 'expected a top-level error message')
      const after = await readdir(tmpdir())
      const leaked = after.filter((name) => name.startsWith('habitex-backup-run-') && !before.has(name))
      assert(leaked.length === 0, `expected no leaked staging directories, found: ${leaked.join(', ')}`)
    })

    await test('unit: computeCombinedCompleteness state machine', async () => {
      assert(
        computeCombinedCompleteness({
          postgres: { completeness: 'COMPLETE', verified: true },
          storage: { completeness: 'COMPLETE', verified: true },
        }) === 'COMPLETE',
      )
      assert(
        computeCombinedCompleteness({
          postgres: { completeness: 'COMPLETE', verified: true },
          storage: { completeness: 'PARTIAL', verified: true },
        }) === 'PARTIAL',
      )
      assert(
        computeCombinedCompleteness({
          postgres: { completeness: 'FAILED' },
          storage: { completeness: 'COMPLETE', verified: true },
        }) === 'FAILED',
      )
      assert(
        computeCombinedCompleteness({
          postgres: { completeness: 'COMPLETE', verified: false },
          storage: { completeness: 'COMPLETE', verified: true },
        }) === 'PARTIAL',
        'a completed-but-unverified upload must not count as COMPLETE',
      )
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
