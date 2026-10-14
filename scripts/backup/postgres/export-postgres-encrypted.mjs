#!/usr/bin/env node
// Wraps the already-validated export-postgres-data.sh (INC-BKP-002) with
// encryption, checksumming, and run-id-based collision-proof naming -
// bringing the PostgreSQL leg of the backup pipeline up to the same
// contract the Storage leg already has (INC-BKP-003), so run-backup.mjs
// (INC-BKP-004) can orchestrate both under one shared run id.
//
// This script does NOT reimplement export-postgres-data.sh's pg_dump
// logic - it spawns that script unmodified via `bash`, captures its stdout
// (the plaintext SQL dump) entirely in memory, and immediately encrypts it
// with the same age stdin/stdout pattern already proven in the Storage
// pipeline (shared/age-helpers.mjs). The plaintext dump is never written to
// disk at any point.
//
// Required environment variables:
//   PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD  - forwarded as-is to
//     export-postgres-data.sh (same contract that script already defines)
//   SNAPSHOT_OUTPUT_DIR   - where <run_id>.postgres.sql.age + its summary land
//   AGE_RECIPIENTS        - comma-separated age public keys, >= 2 required
// Optional:
//   SNAPSHOT_RUN_ID       - override the generated run id (testing/orchestration)
//   PG_EXPORT_DOCKER_CONTAINER - local-dev-only escape hatch. The real
//     target environment (a GitHub Actions Ubuntu runner with
//     postgresql-client installed) has `pg_dump` directly on PATH, which is
//     the default/primary code path below. This machine's host does not
//     (same limitation INC-BKP-001/002 hit) - `pg_dump` only exists inside
//     the local Supabase Postgres container. Setting this variable to that
//     container's name runs the script through `docker exec -i <container>
//     bash -s`, piping the script via stdin (not a `docker cp`'d path -
//     that mangles under MSYS path translation, per INC-BKP-002's own
//     note) purely so this increment's own local tests can run on this
//     specific dev machine. Production CI should never set this.

import { spawn } from 'node:child_process'
import { readFile as readFileAsync, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { generateRunId } from '../shared/run-id.mjs'
import { sha256, encryptBuffer } from '../shared/age-helpers.mjs'
import { SnapshotCollisionError } from '../shared/errors.mjs'
import { assertValidPgEnv } from '../shared/pg-connection-guard.mjs'

const EXPORT_SCRIPT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'export-postgres-data.sh')

export class PostgresExportFailedError extends Error {}

function collectStdout(child) {
  return new Promise((resolve, reject) => {
    const stdoutChunks = []
    let stderr = ''
    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk))
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdoutChunks))
      } else {
        reject(new PostgresExportFailedError(`export-postgres-data.sh exited with code ${code}: ${stderr.trim()}`))
      }
    })
  })
}

/** Runs export-postgres-data.sh unmodified via bash, returning its full stdout as a Buffer. */
async function runPgExportScript(env, dockerContainer) {
  if (dockerContainer) {
    const scriptContents = await readFileAsync(EXPORT_SCRIPT_PATH, 'utf8')
    const envArgs = ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'].flatMap((key) => ['-e', `${key}=${env[key]}`])
    const child = spawn('docker', ['exec', '-i', ...envArgs, dockerContainer, 'bash', '-s'], { shell: false })
    child.stdin.write(scriptContents)
    child.stdin.end()
    return collectStdout(child)
  }
  const child = spawn('bash', [EXPORT_SCRIPT_PATH], { env, shell: false })
  return collectStdout(child)
}

export async function runPostgresExport({
  pgEnv = {
    PGHOST: process.env.PGHOST,
    PGPORT: process.env.PGPORT,
    PGDATABASE: process.env.PGDATABASE,
    PGUSER: process.env.PGUSER,
    PGPASSWORD: process.env.PGPASSWORD,
  },
  outputDir = process.env.SNAPSHOT_OUTPUT_DIR,
  recipients = (process.env.AGE_RECIPIENTS ?? '').split(',').filter(Boolean),
  runId = process.env.SNAPSHOT_RUN_ID ?? generateRunId(),
  dockerContainer = process.env.PG_EXPORT_DOCKER_CONTAINER,
} = {}) {
  for (const key of ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) {
    if (!pgEnv[key]) {
      throw new Error(`${key} is required`)
    }
  }
  // INC-BKP-006: catches a misconfigured PGUSER early when PGHOST points at
  // Supavisor - see shared/pg-connection-guard.mjs for why this is needed.
  assertValidPgEnv(pgEnv)
  if (!outputDir) {
    throw new Error('SNAPSHOT_OUTPUT_DIR is required')
  }
  if (recipients.length < 2) {
    throw new Error(`AGE_RECIPIENTS must list at least 2 independent recipients, got ${recipients.length}`)
  }

  await mkdir(outputDir, { recursive: true })
  const archivePath = path.join(outputDir, `${runId}.postgres.sql.age`)
  const summaryPath = path.join(outputDir, `${runId}.postgres-manifest-summary.json`)
  if (existsSync(archivePath) || existsSync(summaryPath)) {
    throw new SnapshotCollisionError(`snapshot run id "${runId}" already exists at ${outputDir} - refusing to overwrite`)
  }

  const plaintextDump = await runPgExportScript({ ...process.env, ...pgEnv }, dockerContainer)
  const archiveBytes = await encryptBuffer(plaintextDump, recipients)

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
    createdAt: new Date().toISOString(),
    archiveFilename: path.basename(archivePath),
    archiveSha256: sha256(archiveBytes),
    archiveBytes: archiveBytes.length,
    plaintextBytes: plaintextDump.length,
    recipientCount: recipients.length,
    // PostgreSQL export has no partial/missing-object concept the way
    // Storage does (pg_dump either produces a complete data-only dump or
    // fails outright - there's no per-row "this one went missing"
    // granularity) - completeness here just reflects "the script ran to
    // completion," already guaranteed by reaching this line.
    completeness: 'COMPLETE',
  }
  try {
    await writeFile(summaryPath, JSON.stringify(summary, null, 2), { flag: 'wx' })
  } catch (cause) {
    if (cause.code === 'EEXIST') {
      throw new SnapshotCollisionError(`snapshot run id "${runId}" already exists at ${outputDir} - refusing to overwrite`)
    }
    throw cause
  }

  return { runId, archivePath, summaryPath, summary }
}

async function main() {
  const result = await runPostgresExport()
  console.log(JSON.stringify(result.summary, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message)
    process.exitCode = 1
  })
}
