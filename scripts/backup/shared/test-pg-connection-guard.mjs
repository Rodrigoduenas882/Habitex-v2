#!/usr/bin/env node
// Unit tests for shared/pg-connection-guard.mjs (INC-BKP-006). Pure
// in-process, no network/Docker/age dependency - same rationale as
// test-s3-client.mjs: cheap enough to run on every change to the guard.
// Not part of `pnpm test`. Run manually:
//   node scripts/backup/shared/test-pg-connection-guard.mjs

import { assertValidPgEnv, isSupavisorPoolerHost } from './pg-connection-guard.mjs'
import { InvalidPgConnectionError } from './errors.mjs'

const POOLER_HOST = 'aws-0-sa-east-1.pooler.supabase.com'
const VALID_USER = 'backup_reader.eurzpkgikzdvbblgtjwp'

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

function assertThrowsInvalid(fn) {
  try {
    fn()
    throw new Error('expected assertValidPgEnv to throw')
  } catch (err) {
    assert(err instanceof InvalidPgConnectionError, `expected InvalidPgConnectionError, got ${err.constructor.name}: ${err.message}`)
  }
}

async function main() {
  await test('isSupavisorPoolerHost recognizes session+transaction pooler hosts', () => {
    assert(isSupavisorPoolerHost(POOLER_HOST))
    assert(isSupavisorPoolerHost(POOLER_HOST.toUpperCase()), 'should be case-insensitive')
  })

  await test('isSupavisorPoolerHost rejects direct and local hosts', () => {
    assert(!isSupavisorPoolerHost('db.eurzpkgikzdvbblgtjwp.supabase.co'))
    assert(!isSupavisorPoolerHost('127.0.0.1'))
    assert(!isSupavisorPoolerHost(undefined))
  })

  await test('assertValidPgEnv no-ops for a direct connection with a bare role name (no PGPORT check either)', () => {
    assertValidPgEnv({ PGHOST: 'db.eurzpkgikzdvbblgtjwp.supabase.co', PGPORT: '5432', PGUSER: 'backup_reader' })
  })

  await test('assertValidPgEnv no-ops for a local/Docker host with a bare role name', () => {
    assertValidPgEnv({ PGHOST: '127.0.0.1', PGPORT: '5432', PGUSER: 'backup_reader' })
  })

  await test('assertValidPgEnv accepts session mode (port 5432) + "<role>.<project-ref>" against a pooler host', () => {
    assertValidPgEnv({ PGHOST: POOLER_HOST, PGPORT: '5432', PGUSER: VALID_USER })
  })

  await test('assertValidPgEnv accepts a numeric PGPORT 5432 (not just the string)', () => {
    assertValidPgEnv({ PGHOST: POOLER_HOST, PGPORT: 5432, PGUSER: VALID_USER })
  })

  await test('assertValidPgEnv rejects transaction mode (port 6543) against a pooler host, even with a valid username', () => {
    assertThrowsInvalid(() => assertValidPgEnv({ PGHOST: POOLER_HOST, PGPORT: '6543', PGUSER: VALID_USER }))
  })

  await test('assertValidPgEnv rejects a missing PGPORT against a pooler host', () => {
    assertThrowsInvalid(() => assertValidPgEnv({ PGHOST: POOLER_HOST, PGUSER: VALID_USER }))
  })

  await test('assertValidPgEnv rejects a bare role name against a pooler host (the actual bug class)', () => {
    try {
      assertValidPgEnv({ PGHOST: POOLER_HOST, PGPORT: '5432', PGUSER: 'backup_reader' })
      throw new Error('expected assertValidPgEnv to throw')
    } catch (err) {
      assert(err instanceof InvalidPgConnectionError, `expected InvalidPgConnectionError, got ${err.constructor.name}`)
      assert(err.message.includes('project-ref'), 'error message should explain the expected format')
    }
  })

  await test('assertValidPgEnv rejects an uppercase/invalid project-ref segment against a pooler host', () => {
    assertThrowsInvalid(() => assertValidPgEnv({ PGHOST: POOLER_HOST, PGPORT: '5432', PGUSER: 'backup_reader.EURZPKGIKZDVBBLGTJWP' }))
  })

  await test('assertValidPgEnv rejects an empty role segment against a pooler host', () => {
    assertThrowsInvalid(() => assertValidPgEnv({ PGHOST: POOLER_HOST, PGPORT: '5432', PGUSER: '.eurzpkgikzdvbblgtjwp' }))
  })

  await test('assertValidPgEnv rejects an undefined PGUSER against a pooler host', () => {
    assertThrowsInvalid(() => assertValidPgEnv({ PGHOST: POOLER_HOST, PGPORT: '5432', PGUSER: undefined }))
  })

  await test('assertValidPgEnv rejects an empty-string PGUSER against a pooler host', () => {
    assertThrowsInvalid(() => assertValidPgEnv({ PGHOST: POOLER_HOST, PGPORT: '5432', PGUSER: '' }))
  })

  await test('assertValidPgEnv tolerates leading/trailing whitespace on PGUSER (e.g. a secret pasted with a trailing newline)', () => {
    assertValidPgEnv({ PGHOST: POOLER_HOST, PGPORT: '5432', PGUSER: `  ${VALID_USER}  ` })
  })

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length > 0) {
    process.exitCode = 1
  }
}

main()
