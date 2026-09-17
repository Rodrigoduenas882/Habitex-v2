import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_STORAGE_KEY } from './theme'
import { useTheme } from './useTheme'

function mockMatchMedia(initialPrefersDark: boolean) {
  let changeListener: ((event: { matches: boolean }) => void) | null = null

  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: initialPrefersDark,
      media: query,
      addEventListener: (event: string, listener: (event: { matches: boolean }) => void) => {
        if (event === 'change') changeListener = listener
      },
      removeEventListener: vi.fn(),
    })),
  )

  return {
    fireChange(matches: boolean) {
      changeListener?.({ matches })
    },
  }
}

describe('useTheme', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves and applies "system" to the current OS theme when nothing is stored', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useTheme())

    expect(result.current.preference).toBe('system')
    expect(result.current.resolvedTheme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('reacts live to an OS theme change while the preference is "system"', () => {
    const media = mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    expect(result.current.resolvedTheme).toBe('light')

    act(() => {
      media.fireChange(true)
    })

    expect(result.current.resolvedTheme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('switching to an explicit preference persists it to the existing storage key', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setPreference('dark')
    })

    expect(result.current.preference).toBe('dark')
    expect(result.current.resolvedTheme).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('an explicit preference no longer follows subsequent OS changes', () => {
    const media = mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setPreference('light')
    })

    act(() => {
      media.fireChange(true)
    })

    expect(result.current.preference).toBe('light')
    expect(result.current.resolvedTheme).toBe('light')
  })

  it('switching back to "system" resumes following the OS setting', () => {
    const media = mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setPreference('dark')
    })
    act(() => {
      result.current.setPreference('system')
    })

    expect(result.current.resolvedTheme).toBe('light')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system')

    act(() => {
      media.fireChange(true)
    })
    expect(result.current.resolvedTheme).toBe('dark')
  })
})
