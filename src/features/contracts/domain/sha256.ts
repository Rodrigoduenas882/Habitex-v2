function toHex(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let hex = ''
  for (const byte of view) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * Computes the SHA-256 digest of `blob`'s actual bytes only - never the
 * filename, path, or any other metadata - and returns it as a 64-character
 * lowercase hex string. This matches both the backend's own
 * `^[A-Fa-f0-9]{64}$` check on document_hash and its `lower(p_document_hash)`
 * normalization on insert, so the value this function returns can be sent to
 * register_habitex_generated_contract as-is.
 *
 * Uses the Web Crypto API (`crypto.subtle.digest`), a global available in
 * every browser this app targets - no hashing dependency is added for this.
 */
export async function computeSha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return toHex(digest)
}
