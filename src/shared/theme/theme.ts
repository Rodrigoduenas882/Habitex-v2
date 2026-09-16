export type Theme = 'light' | 'dark'

/**
 * Keep in sync with the anti-FOUC inline script in index.html, which applies
 * the theme before React mounts using this same storage key.
 */
export const THEME_STORAGE_KEY = 'habitex:theme'

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

export function getSystemTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(value) ? value : null
  } catch {
    // Storage may be unavailable (private mode, disabled cookies, etc).
    return null
  }
}

export function resolveInitialTheme(): Theme {
  return readStoredTheme() ?? getSystemTheme()
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Theme still applies for this session even if it can't be persisted.
  }
}
