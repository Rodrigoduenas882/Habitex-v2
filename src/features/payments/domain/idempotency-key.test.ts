import { afterEach, describe, expect, it } from 'vitest'
import { clearPendingIdempotencyKey, getOrCreatePendingIdempotencyKey } from './idempotency-key'

afterEach(() => {
  sessionStorage.clear()
})

describe('getOrCreatePendingIdempotencyKey', () => {
  it('generates a new key for a relationship that has no pending attempt yet', () => {
    const key = getOrCreatePendingIdempotencyKey('rel-1')

    expect(typeof key).toBe('string')
    expect(key.length).toBeGreaterThan(0)
  })

  it('returns the exact same key on a second call for the same relationship (reload/manual retry)', () => {
    const first = getOrCreatePendingIdempotencyKey('rel-1')
    const second = getOrCreatePendingIdempotencyKey('rel-1')

    expect(second).toBe(first)
  })

  it('scopes the key per relationship - two different relationships never share one', () => {
    const relOne = getOrCreatePendingIdempotencyKey('rel-1')
    const relTwo = getOrCreatePendingIdempotencyKey('rel-2')

    expect(relOne).not.toBe(relTwo)
  })

  it('persists across independent calls (simulating a reload) via sessionStorage, not just in-memory state', () => {
    const before = getOrCreatePendingIdempotencyKey('rel-1')
    // A reload never clears sessionStorage - calling again as a brand-new,
    // unrelated invocation (no shared JS state) must still see the same value.
    const afterReload = getOrCreatePendingIdempotencyKey('rel-1')

    expect(afterReload).toBe(before)
    expect(sessionStorage.getItem('habitex:payment-report-idempotency:rel-1')).toBe(before)
  })
})

describe('clearPendingIdempotencyKey', () => {
  it('removes the pending key so the next call generates a brand-new one', () => {
    const original = getOrCreatePendingIdempotencyKey('rel-1')
    clearPendingIdempotencyKey('rel-1')
    const afterClear = getOrCreatePendingIdempotencyKey('rel-1')

    expect(afterClear).not.toBe(original)
  })

  it('never stores anything beyond the opaque key itself', () => {
    getOrCreatePendingIdempotencyKey('rel-1')

    expect(Object.keys(sessionStorage)).toEqual(['habitex:payment-report-idempotency:rel-1'])
  })
})
