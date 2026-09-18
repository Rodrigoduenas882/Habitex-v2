import type { AccessibleAdministration } from '../domain/administration.types'
import { useAccessibleAdministrations } from './useAccessibleAdministrations'

export type CurrentAdministrationState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'none' }
  | { status: 'selection-required'; options: readonly AccessibleAdministration[] }
  | { status: 'resolved'; administration: AccessibleAdministration }

/**
 * Resolves 0/1/N accessible administrations into an explicit state.
 *
 * Deliberately never picks options[0] for the "more than one" case - that
 * would silently guess which administration the person meant to work in.
 * No localStorage, no persisted selection, no picker UI - this only
 * reports the state; picking a current administration out of
 * 'selection-required' is a later increment.
 */
export function useCurrentAdministration(): CurrentAdministrationState {
  const { data, isLoading, isError, error } = useAccessibleAdministrations()

  if (isLoading) {
    return { status: 'loading' }
  }

  if (isError) {
    return { status: 'error', error }
  }

  const administrations = data ?? []

  if (administrations.length === 0) {
    return { status: 'none' }
  }

  if (administrations.length === 1) {
    const [only] = administrations
    if (only) {
      return { status: 'resolved', administration: only }
    }
  }

  return { status: 'selection-required', options: administrations }
}
