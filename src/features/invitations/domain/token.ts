function toHex(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let hex = ''
  for (const byte of view) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * A fresh, unguessable raw invitation token - crypto.randomUUID() (Web Crypto,
 * already the only random-generation precedent in this codebase, e.g.
 * features/documents/domain/storage-path.ts) provides 122 bits of randomness,
 * ample for a bearer-token use case. Never invent custom randomness.
 */
export function generateInvitationToken(): string {
  return crypto.randomUUID()
}

/**
 * SHA-256 hex digest of a raw string (not a Blob) - the string-input sibling of
 * features/contracts/domain/sha256.ts's own computeSha256Hex(blob), which is scoped
 * to file-hashing and not reused here. Matches the backend's own
 * ^[0-9a-fA-F]{64}$ check and its own lower(p_token_hash) normalization (this always
 * produces lowercase hex already, via the same toHex byte-by-byte approach).
 */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return toHex(digest)
}
