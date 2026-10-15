// A minimal, dependency-free archive format for packing a directory tree
// into one buffer and back. Exists only to round-trip between this script
// family's own export/restore pair - it is not a tar implementation and
// never needs to be, since nothing outside these two scripts ever reads or
// writes this format.
//
// Why not just shell out to `tar`: this repo's Git-Bash-provided `tar`
// binary expects POSIX-style paths, but Node on Windows produces
// backslash/drive-letter paths (`C:\Users\...`) when spawned directly
// (spawn() never goes through a shell, so there is no MSYS path-translation
// step to rely on) - GNU tar then misparses a bare `C:` prefix as a remote
// `host:path` spec and fails outright. Avoiding an external packing tool
// sidesteps that entire class of path-interop problem.
//
// Format: [4-byte big-endian index length][JSON index][concatenated file
// bytes, in index order]. The index is `[{ path, size }]`, with `path`
// always POSIX-style (forward slashes) regardless of platform, so the
// archive itself is platform-independent even though the packer/unpacker
// run on whatever OS they run on.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

async function listFilesRecursive(dir, base = dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await listFilesRecursive(full, base)))
    } else {
      out.push(path.relative(base, full).split(path.sep).join('/'))
    }
  }
  return out.sort()
}

export async function packDirectory(sourceDir) {
  const relativePaths = await listFilesRecursive(sourceDir)
  const buffers = []
  const index = []
  for (const relativePath of relativePaths) {
    const bytes = await readFile(path.join(sourceDir, ...relativePath.split('/')))
    index.push({ path: relativePath, size: bytes.length })
    buffers.push(bytes)
  }
  const indexBytes = Buffer.from(JSON.stringify(index), 'utf8')
  const header = Buffer.alloc(4)
  header.writeUInt32BE(indexBytes.length, 0)
  return Buffer.concat([header, indexBytes, ...buffers])
}

export class UnsafeArchiveEntryError extends Error {}

/**
 * Rejects any entry path that could escape `outputDir` once resolved -
 * `..` segments, an absolute path, or a drive letter. This matters because
 * `entry.path` comes from inside the packed buffer itself, which for a
 * restore is the *decrypted ciphertext* - content this script never
 * validates against anything external. An `age` recipient's public key is
 * not a secret (age never authenticates the sender), so anyone holding it
 * could in principle craft a malicious package naming `../../something` and
 * get it encrypted for that recipient; nothing upstream of this function
 * should be trusted to have already screened that out. A resolved path that
 * doesn't stay under `outputDir` is refused outright (zip-slip guard).
 */
function resolveSafeDestPath(outputDir, entryPath) {
  if (path.isAbsolute(entryPath) || /^[a-zA-Z]:/.test(entryPath)) {
    throw new UnsafeArchiveEntryError(`archive entry has an absolute/drive-letter path: ${entryPath}`)
  }
  const destPath = path.resolve(outputDir, ...entryPath.split('/'))
  const resolvedOutputDir = path.resolve(outputDir)
  if (destPath !== resolvedOutputDir && !destPath.startsWith(resolvedOutputDir + path.sep)) {
    throw new UnsafeArchiveEntryError(`archive entry escapes the output directory: ${entryPath}`)
  }
  return destPath
}

export async function unpackToDirectory(archiveBuffer, outputDir) {
  const indexLength = archiveBuffer.readUInt32BE(0)
  const index = JSON.parse(archiveBuffer.subarray(4, 4 + indexLength).toString('utf8'))
  let offset = 4 + indexLength
  for (const entry of index) {
    const bytes = archiveBuffer.subarray(offset, offset + entry.size)
    offset += entry.size
    const destPath = resolveSafeDestPath(outputDir, entry.path)
    await mkdir(path.dirname(destPath), { recursive: true })
    await writeFile(destPath, bytes)
  }
  return index
}
