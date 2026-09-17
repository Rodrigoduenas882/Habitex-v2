import { useCallback, useEffect, useState } from 'react'
import {
  applyResolvedTheme,
  getSystemTheme,
  persistPreference,
  resolveInitialPreference,
  type Theme,
  type ThemePreference,
} from './theme'

/**
 * Purely local UI preference (not server state, not shared across users), so
 * this is a small hook backed by localStorage rather than Zustand or Query.
 *
 * `preference` is what the user picked (light/dark/system); `resolvedTheme`
 * is what's actually applied to the document. When the preference is
 * 'system', resolvedTheme tracks the OS setting live via a matchMedia
 * listener, so a system-level theme change updates the app immediately
 * without a reload.
 */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(resolveInitialPreference)
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    function handleChange(event: MediaQueryListEvent) {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    media.addEventListener('change', handleChange)
    return () => {
      media.removeEventListener('change', handleChange)
    }
  }, [])

  const resolvedTheme: Theme = preference === 'system' ? systemTheme : preference

  useEffect(() => {
    applyResolvedTheme(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    persistPreference(preference)
  }, [preference])

  const setThemePreference = useCallback((next: ThemePreference) => {
    setPreference(next)
  }, [])

  return { preference, resolvedTheme, setPreference: setThemePreference }
}
