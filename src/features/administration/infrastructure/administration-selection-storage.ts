const SELECTED_ADMINISTRATION_STORAGE_KEY = 'habitex:selected-administration-id'

/**
 * Persists which administration the viewer picked out of a
 * 'selection-required' state - a per-viewer navigation preference, not a
 * business fact. The source of truth for *which administrations a person
 * can access* stays administration_members/RLS (via
 * useAccessibleAdministrations); this only remembers which one they last
 * chose to work in, same pattern as src/shared/theme/theme.ts for the theme
 * preference.
 *
 * Tolerates localStorage being unavailable or throwing (private mode,
 * disabled storage, etc) - a failed read/write never breaks the picker, it
 * just means the choice isn't remembered for next time.
 */
export function readSelectedAdministrationId(): string | null {
  try {
    return window.localStorage.getItem(SELECTED_ADMINISTRATION_STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeSelectedAdministrationId(id: string): void {
  try {
    window.localStorage.setItem(SELECTED_ADMINISTRATION_STORAGE_KEY, id)
  } catch {
    // The selection still applies for this session even if it can't be persisted.
  }
}

/**
 * Drops the persisted selection. This key is global (not scoped by user id),
 * so on an identity change in the same tab (logout of A -> login of B, no
 * reload) a stale id left by the previous viewer could otherwise resolve
 * 'resolved' for an administration B never chose themselves in their own
 * session - just because B also happens to have legitimate access to the
 * same administration (e.g. co-administrators). AuthSessionListener calls
 * this alongside its query-cache cleanup for exactly that case; see its
 * docstring and ARCHITECTURE.md §6.
 */
export function clearSelectedAdministrationId(): void {
  try {
    window.localStorage.removeItem(SELECTED_ADMINISTRATION_STORAGE_KEY)
  } catch {
    // Nothing to reconcile - if removal fails, the next explicit select() overwrites it anyway.
  }
}
