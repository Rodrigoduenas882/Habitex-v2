import { describe, expect, it } from 'vitest'
import { computeSha256Hex } from './sha256'

describe('computeSha256Hex', () => {
  it('produces the known, deterministic SHA-256 digest for a fixed input', async () => {
    // A real, independently-known SHA-256 test vector (echo -n "hello world"
    // | sha256sum), not a snapshot of whatever this function happens to
    // output.
    const blob = new Blob(['hello world'])

    const hex = await computeSha256Hex(blob)

    expect(hex).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')
  })

  it('returns a 64-character lowercase hex string, matching the backend regex', async () => {
    const hex = await computeSha256Hex(new Blob(['another fixed input']))

    expect(hex).toMatch(/^[a-f0-9]{64}$/)
  })

  it('hashes only the bytes, ignoring any notion of filename/metadata (same content, different construction, same digest)', async () => {
    const a = await computeSha256Hex(new Blob(['same content']))
    const b = await computeSha256Hex(new Blob(['same', ' content']))

    expect(a).toBe(b)
  })

  it('produces different digests for different content', async () => {
    const a = await computeSha256Hex(new Blob(['content a']))
    const b = await computeSha256Hex(new Blob(['content b']))

    expect(a).not.toBe(b)
  })
})
