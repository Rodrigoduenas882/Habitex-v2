import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearSelectedAdministrationId,
  readSelectedAdministrationId,
  writeSelectedAdministrationId,
} from './administration-selection-storage'

const STORAGE_KEY = 'habitex:selected-administration-id'

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('readSelectedAdministrationId', () => {
  it('returns null when nothing has been persisted', () => {
    expect(readSelectedAdministrationId()).toBeNull()
  })

  it('returns the persisted id', () => {
    window.localStorage.setItem(STORAGE_KEY, 'admin-1')

    expect(readSelectedAdministrationId()).toBe('admin-1')
  })

  it('returns null instead of throwing when localStorage.getItem throws', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    expect(readSelectedAdministrationId()).toBeNull()
  })
})

describe('writeSelectedAdministrationId', () => {
  it('persists the id under the habitex:selected-administration-id key', () => {
    writeSelectedAdministrationId('admin-2')

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('admin-2')
  })

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    expect(() => {
      writeSelectedAdministrationId('admin-3')
    }).not.toThrow()
  })
})

describe('clearSelectedAdministrationId', () => {
  it('removes a previously persisted id', () => {
    window.localStorage.setItem(STORAGE_KEY, 'admin-1')

    clearSelectedAdministrationId()

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('is a no-op when nothing was persisted', () => {
    expect(() => {
      clearSelectedAdministrationId()
    }).not.toThrow()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('does not throw when localStorage.removeItem throws', () => {
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    expect(() => {
      clearSelectedAdministrationId()
    }).not.toThrow()
  })
})
