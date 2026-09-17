export type Theme = 'light' | 'dark'

/** What the user actually chose - 'system' tracks the OS preference live. */
export type ThemePreference = Theme | 'system'

/**
 * Keep in sync with the anti-FOUC inline script in index.html, which applies
 * the theme before React mounts using this same storage key. Stores the
 * *preference* ('light' | 'dark' | 'system'), not the resolved theme - the
 * inline script and getSystemTheme() are what resolve 'system' to an actual
 * light/dark value.
 */
export const THEME_STORAGE_KEY = 'habitex:theme'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function getSystemTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function readStoredPreference(): ThemePreference | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(value) ? value : null
  } catch {
    // Storage may be unavailable (private mode, disabled cookies, etc).
    return null
  }
}

/** No stored preference defaults to 'system', not a one-time light/dark guess. */
export function resolveInitialPreference(): ThemePreference {
  return readStoredPreference() ?? 'system'
}

export function resolveAppliedTheme(preference: ThemePreference): Theme {
  return preference === 'system' ? getSystemTheme() : preference
}

export function persistPreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Preference still applies for this session even if it can't be persisted.
  }
}

export function applyResolvedTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}
