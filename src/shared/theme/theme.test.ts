import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, getSystemTheme, resolveInitialTheme, THEME_STORAGE_KEY } from './theme'

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

  it('falls back to the system preference when nothing is stored', () => {
    mockMatchMedia(true)
    expect(getSystemTheme()).toBe('dark')
    expect(resolveInitialTheme()).toBe('dark')
  })

  it('prefers the stored theme over the system preference', () => {
    mockMatchMedia(true)
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    expect(resolveInitialTheme()).toBe('light')
  })

  it('ignores a corrupted stored value', () => {
    mockMatchMedia(false)
    window.localStorage.setItem(THEME_STORAGE_KEY, 'not-a-theme')
    expect(resolveInitialTheme()).toBe('light')
  })

  it('applies the theme to the document and persists it', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })
})
