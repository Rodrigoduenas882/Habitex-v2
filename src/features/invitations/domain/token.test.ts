import { describe, expect, it } from 'vitest'
import { generateInvitationToken, sha256Hex } from './token'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('generateInvitationToken', () => {
  it('returns a well-formed UUID', () => {
    const token = generateInvitationToken()

    expect(token).toMatch(UUID_PATTERN)
  })

  it('never produces the same token twice', () => {
    const first = generateInvitationToken()
    const second = generateInvitationToken()

    expect(first).not.toBe(second)
  })
})

describe('sha256Hex', () => {
  it('produces the known, deterministic SHA-256 digest for a fixed input', async () => {
    // A real, independently-known SHA-256 test vector (echo -n "hello world"
    // | sha256sum), not a snapshot of whatever this function happens to
    // output.
    const hex = await sha256Hex('hello world')

    expect(hex).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')
  })

  it('returns a 64-character lowercase hex string, matching the backend regex ^[0-9a-fA-F]{64}$', async () => {
    const hex = await sha256Hex('another fixed input')

    expect(hex).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces different digests for different content', async () => {
    const a = await sha256Hex('content a')
    const b = await sha256Hex('content b')

    expect(a).not.toBe(b)
  })

  it('produces the same digest for the same content', async () => {
    const a = await sha256Hex('same content')
    const b = await sha256Hex('same content')

    expect(a).toBe(b)
  })
})
