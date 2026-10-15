#!/usr/bin/env node
// Decrypts, extracts, and verifies a snapshot produced by
// export-storage-snapshot.mjs. Three layers of verification, each able to
// fail independently and each reported distinctly (never merged into one
// generic "restore failed"):
//   1. Archive-level: the encrypted file's own sha256 against the summary
//      manifest's recorded value - catches bit-rot/corruption of the
//      ciphertext itself, before ever attempting to decrypt it.
//   2. Decryption: age -d against a supplied identity file - catches a
//      wrong/missing identity or a ciphertext that doesn't decrypt cleanly.
//   3. Object-level: after extraction, recomputes sha256 of every extracted
//      file and compares it against the inner manifest.json's recorded
//      value - catches corruption introduced during/after extraction, and
//      confirms the restored bytes are exactly what was backed up.
//
// Required environment variables / args:
//   node restore-storage-snapshot.mjs <archive.snapshot.age> <identity-file> <output-dir>
// The paired "<run_id>.manifest-summary.json" is expected next to the
// archive (same convention the exporter writes it under).

import { mkdir, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { unpackToDirectory, UnsafeArchiveEntryError } from './pack.mjs'
import { sha256, decryptBuffer, DecryptionFailedError } from '../shared/age-helpers.mjs'

export { UnsafeArchiveEntryError, DecryptionFailedError }
export class ArchiveCorruptedError extends Error {}

async function walkFiles(dir, base = dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(full, base)))
    } else {
      out.push(path.relative(base, full).split(path.sep).join('/'))
    }
  }
  return out
}

export async function runRestore({ archivePath, summaryPath, identityPath, outputDir }) {
  summaryPath ??= archivePath.replace(/\.snapshot\.age$/, '.manifest-summary.json')

  const archiveBytes = await readFile(archivePath)
  const archiveSha256 = sha256(archiveBytes)

  let summary = null
  try {
    summary = JSON.parse(await readFile(summaryPath, 'utf8'))
  } catch {
    // No summary alongside the archive - proceed without the pre-decryption
    // checksum gate, verification still happens at the object level below.
    // Surfaced explicitly via archiveChecksumLayer below, never silently -
    // a restore missing this layer must not look identical to one that ran
    // all 3.
  }

  let archiveChecksumLayer
  if (summary) {
    if (summary.archiveSha256 !== archiveSha256) {
      throw new ArchiveCorruptedError(
        `archive checksum mismatch: expected ${summary.archiveSha256}, got ${archiveSha256} - the encrypted file is corrupted or was tampered with`,
      )
    }
    archiveChecksumLayer = 'VERIFIED'
  } else {
    archiveChecksumLayer = 'SKIPPED_NO_SUMMARY'
  }

  const packedBuffer = await decryptBuffer(archiveBytes, identityPath)

  await mkdir(outputDir, { recursive: true })
  await unpackToDirectory(packedBuffer, outputDir)

  const manifest = JSON.parse(await readFile(path.join(outputDir, 'manifest.json'), 'utf8'))
  const verification = []
  for (const object of manifest.objects) {
    if (object.status !== 'DOWNLOADED') {
      verification.push({ bucket: object.bucket, path: object.path, result: 'SKIPPED_MISSING_AT_BACKUP_TIME' })
      continue
    }
    const extractedPath = path.join(outputDir, 'objects', object.bucket, object.path)
    try {
      const bytes = await readFile(extractedPath)
      const actualSha256 = sha256(bytes)
      verification.push({
        bucket: object.bucket,
        path: object.path,
        result: actualSha256 === object.sha256 ? 'MATCH' : 'MISMATCH',
        expectedSha256: object.sha256,
        actualSha256,
        sizeBytes: bytes.length,
      })
    } catch {
      verification.push({ bucket: object.bucket, path: object.path, result: 'MISSING_IN_RESTORE' })
    }
  }

  const extractedFiles = await walkFiles(path.join(outputDir, 'objects'))
  const expectedFiles = manifest.objects.filter((o) => o.status === 'DOWNLOADED').map((o) => `${o.bucket}/${o.path}`)
  const unexpectedFiles = extractedFiles.filter((f) => !expectedFiles.includes(f))

  const allMatch = verification.every((v) => v.result === 'MATCH' || v.result === 'SKIPPED_MISSING_AT_BACKUP_TIME')
  return {
    archiveSha256,
    archiveChecksumLayer,
    manifest,
    verification,
    unexpectedFiles,
    restoreStatus: allMatch && unexpectedFiles.length === 0 ? 'VERIFIED' : 'INTEGRITY_FAILURE',
  }
}

async function main() {
  const [archivePath, identityPath, outputDir] = process.argv.slice(2)
  if (!archivePath || !identityPath || !outputDir) {
    console.error('usage: restore-storage-snapshot.mjs <archive.snapshot.age> <identity-file> <output-dir>')
    process.exitCode = 2
    return
  }
  const result = await runRestore({ archivePath, identityPath, outputDir })
  console.log(JSON.stringify(result, null, 2))
  if (result.restoreStatus !== 'VERIFIED') {
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message)
    process.exitCode = 1
  })
}
