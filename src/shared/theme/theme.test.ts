import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyResolvedTheme,
  getSystemTheme,
  persistPreference,
  readStoredPreference,
  resolveInitialPreference,
  THEME_STORAGE_KEY,
} from './theme'

function mockMatchMedia(prefersDark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: prefersDark,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

describe('theme', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults the preference to "system" when nothing is stored', () => {
    expect(readStoredPreference()).toBeNull()
    expect(resolveInitialPreference()).toBe('system')
  })

  it('prefers a stored explicit preference over the default', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(resolveInitialPreference()).toBe('dark')
  })

  it('accepts "system" as a stored, explicit preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'system')
    expect(resolveInitialPreference()).toBe('system')
  })

  it('ignores a corrupted stored value and falls back to "system"', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'not-a-theme')
    expect(resolveInitialPreference()).toBe('system')
  })

  it('reads the OS preference via matchMedia', () => {
    mockMatchMedia(true)
    expect(getSystemTheme()).toBe('dark')

    mockMatchMedia(false)
    expect(getSystemTheme()).toBe('light')
  })

  it('persists the preference as-is, including "system"', () => {
    persistPreference('system')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system')

    persistPreference('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('applies a resolved theme to the document without touching storage', () => {
    applyResolvedTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })
})
