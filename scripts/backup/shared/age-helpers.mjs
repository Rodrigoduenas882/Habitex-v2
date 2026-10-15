// Shared age encrypt/decrypt + sha256 helpers. Extracted from
// storage/export-storage-snapshot.mjs and restore-storage-snapshot.mjs
// (INC-BKP-003, already validated there: stdin/stdout piping avoids ever
// writing plaintext to disk, and sidesteps the Windows path-interop
// problems that broke invoking `tar` directly - see
// docs/ops/storage-backup-validation-findings.md §2) so the PostgreSQL leg
// of the orchestrator (INC-BKP-004) uses the exact same, already-proven
// mechanism instead of a second implementation.

import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

/** Runs `cmd`, feeding `inputBuffer` to stdin and resolving with stdout as a Buffer. */
function runPiped(cmd, args, inputBuffer) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: false })
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
        reject(new Error(`${cmd} exited with code ${code}: ${stderr.trim()}`))
      }
    })
    child.stdin.write(inputBuffer)
    child.stdin.end()
  })
}

export class EncryptionFailedError extends Error {}
export class DecryptionFailedError extends Error {}

/** Encrypts `buffer` in memory for every recipient in `recipients` (>= 2 required by callers, not enforced here). */
export async function encryptBuffer(buffer, recipients) {
  try {
    const recipientArgs = recipients.flatMap((r) => ['-r', r])
    return await runPiped('age', [...recipientArgs], buffer)
  } catch (cause) {
    throw new EncryptionFailedError(`age encryption failed: ${cause.message}`)
  }
}

/** Decrypts `buffer` with the identity at `identityPath`. */
export async function decryptBuffer(buffer, identityPath) {
  try {
    return await runPiped('age', ['-d', '-i', identityPath], buffer)
  } catch (cause) {
    throw new DecryptionFailedError(`decryption failed (wrong identity, or corrupted ciphertext): ${cause.message}`)
  }
}
