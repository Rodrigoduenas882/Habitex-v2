import { describe, expect, it } from 'vitest'
import { buildStoragePath } from './storage-path'

const ADMINISTRATION_ID = 'admin-123'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('buildStoragePath', () => {
  it('starts with {administrationId}/ followed by a well-formed UUID', () => {
    const blob = new Blob(['content'], { type: 'application/pdf' })

    const path = buildStoragePath(ADMINISTRATION_ID, blob)

    expect(path.startsWith(`${ADMINISTRATION_ID}/`)).toBe(true)
    const uuidSegment = path.slice(`${ADMINISTRATION_ID}/`.length, path.lastIndexOf('.'))
    expect(uuidSegment).toMatch(UUID_PATTERN)
  })

  it('never produces the same path twice, since the UUID segment guarantees uniqueness', () => {
    const blob = new Blob(['content'], { type: 'application/pdf' })

    const first = buildStoragePath(ADMINISTRATION_ID, blob)
    const second = buildStoragePath(ADMINISTRATION_ID, blob)

    expect(first).not.toBe(second)
  })

  it('never incorporates originalName into the returned path, even a deliberately dangerous one', () => {
    const blob = new Blob(['content'], { type: 'application/pdf' })
    const dangerousNames = ['../../etc/passwd', 'a/b/c', '../secret']

    for (const dangerousName of dangerousNames) {
      const path = buildStoragePath(ADMINISTRATION_ID, blob, dangerousName)
      expect(path).not.toContain('etc')
      expect(path).not.toContain('passwd')
      expect(path).not.toContain('secret')
      expect(path).not.toContain('a/b/c')
      // Only one '/' is expected: the administrationId/uuid separator.
      expect(path.split('/')).toHaveLength(2)
    }
  })

  it.each([
    ['application/pdf', '.pdf'],
    ['image/jpeg', '.jpg'],
    ['image/png', '.png'],
    ['image/webp', '.webp'],
  ])('maps %s to the %s extension', (mimeType, expectedExtension) => {
    const blob = new Blob(['content'], { type: mimeType })

    const path = buildStoragePath(ADMINISTRATION_ID, blob)

    expect(path.endsWith(expectedExtension)).toBe(true)
  })

  it('appends no extension for an unrecognized MIME type', () => {
    const blob = new Blob(['content'], { type: 'application/x-unknown-type' })

    const path = buildStoragePath(ADMINISTRATION_ID, blob)

    expect(path).not.toContain('.')
  })
})
