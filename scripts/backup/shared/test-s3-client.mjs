#!/usr/bin/env node
// Unit tests for shared/s3-client.mjs + shared/mock-r2-server.mjs. Unlike
// test-run-backup.mjs / storage/test-storage-snapshot.mjs, this suite needs
// no live Supabase stack, Docker, or `age` - it's pure in-process HTTP
// against the mock server, so it's cheap enough to run on every change to
// either file. Still not part of `pnpm test` (no new dependency added to
// the main app's test graph for a backup-tooling-only concern), but has no
// external prerequisites either - just `node scripts/backup/shared/test-s3-client.mjs`.

import { startMockR2Server } from './mock-r2-server.mjs'
import { createS3Client, R2CollisionError, R2RequestError } from './s3-client.mjs'

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

async function withMock(fn) {
  const mock = await startMockR2Server()
  try {
    return await fn(mock)
  } finally {
    await mock.close()
  }
}

async function main() {
  await test('put/get/head round-trip', async () => {
    await withMock(async (mock) => {
      const client = createS3Client({ endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: mock.secretAccessKey, bucket: mock.bucket })
      await client.putObject('a/b.txt', Buffer.from('hello'))
      const got = await client.getObject('a/b.txt')
      assert(got.toString() === 'hello', 'GET did not return the uploaded bytes')
      const head = await client.headObject('a/b.txt')
      assert(head.contentLength === 5, `expected contentLength 5, got ${head.contentLength}`)
      assert((await client.getObject('does-not-exist')) === null, 'GET on a missing key must return null, not throw')
      assert((await client.headObject('does-not-exist')) === null, 'HEAD on a missing key must return null, not throw')
    })
  })

  await test('conditional PUT (If-None-Match: *) rejects a collision atomically', async () => {
    await withMock(async (mock) => {
      const client = createS3Client({ endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: mock.secretAccessKey, bucket: mock.bucket })
      await client.putObject('x.txt', Buffer.from('first'))
      let threw = false
      try {
        await client.putObject('x.txt', Buffer.from('second'), { ifNoneMatch: '*' })
      } catch (err) {
        threw = err instanceof R2CollisionError
      }
      assert(threw, 'expected R2CollisionError on a conditional PUT to an existing key')
      const unchanged = await client.getObject('x.txt')
      assert(unchanged.toString() === 'first', 'the pre-existing object must not have been overwritten')
    })
  })

  await test('an incorrect secret key is rejected by independent signature verification', async () => {
    await withMock(async (mock) => {
      const badClient = createS3Client({ endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: 'wrong-secret', bucket: mock.bucket })
      let threw = false
      try {
        await badClient.putObject('x.txt', Buffer.from('x'))
      } catch (err) {
        threw = err instanceof R2RequestError && err.message.includes('403')
      }
      assert(threw, 'expected a 403 R2RequestError for a wrong secret key')
    })
  })

  await test('regression (MEDIUM, independent review): object keys with ! * \' ( ) round-trip correctly', async () => {
    // AWS SigV4's canonical-request URI-encoding requires escaping these 5
    // characters beyond what encodeURIComponent does on its own - a real
    // S3/R2 endpoint re-derives its own canonical request from the decoded
    // key and would reject a signature computed over the wrong encoding.
    // This pipeline's own internally-generated keys never contain these
    // characters (always <runId>/<runId>.<ext>), but s3-client.mjs is
    // written as a reusable client, so this was a real latent defect.
    await withMock(async (mock) => {
      const client = createS3Client({ endpoint: mock.url, accessKeyId: mock.accessKeyId, secretAccessKey: mock.secretAccessKey, bucket: mock.bucket })
      const key = "run-id/weird!file*name'(1)~also.age"
      await client.putObject(key, Buffer.from('special chars content'))
      const got = await client.getObject(key)
      assert(got.toString() === 'special chars content', 'round-trip failed for a key containing ! * \' ( )')
      assert(mock.objects.has(key), 'the stored key should be the exact logical key, not a mangled encoding')
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
