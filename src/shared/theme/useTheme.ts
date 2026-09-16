import { useCallback, useEffect, useState } from 'react'
import { applyTheme, resolveInitialTheme, type Theme } from './theme'

/**
 * Purely local UI preference (not server state, not shared across users), so
 * this is a small hook backed by localStorage rather than Zustand or Query.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, setTheme, toggleTheme }
}
