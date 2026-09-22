import { useCallback, useState } from 'react'
import type { AccessibleAdministration } from '../domain/administration.types'
import {
  readSelectedAdministrationId,
  writeSelectedAdministrationId,
} from '../infrastructure/administration-selection-storage'
import { useCurrentAdministration } from './useCurrentAdministration'

export type ActiveAdministrationState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'none' }
  | {
      status: 'selection-required'
      options: readonly AccessibleAdministration[]
      select: (id: string) => void
    }
  | { status: 'resolved'; administration: AccessibleAdministration }

/**
 * Wraps useCurrentAdministration() with a persisted per-viewer selection for
 * the 'selection-required' case - useCurrentAdministration's own docstring
 * calls this out as a later increment ("picking a current administration
 * out of 'selection-required' is a later increment"); this hook is that
 * increment, without changing useCurrentAdministration itself.
 *
 * The persisted id is a per-viewer navigation preference (localStorage, see
 * administration-selection-storage.ts), not a business fact - the source of
 * truth for *which* administrations someone can access stays
 * administration_members/RLS via useAccessibleAdministrations, reached only
 * through useCurrentAdministration() here (never called a second time).
 *
 * If the persisted id no longer matches one of the current options (access
 * revoked, or nothing persisted yet), this reports 'selection-required'
 * again instead of silently guessing - same "never auto-pick" principle as
 * useCurrentAdministration.
 */
export function useActiveAdministration(): ActiveAdministrationState {
  const current = useCurrentAdministration()
  const [selectedId, setSelectedId] = useState<string | null>(readSelectedAdministrationId)

  const select = useCallback((id: string) => {
    writeSelectedAdministrationId(id)
    setSelectedId(id)
  }, [])

  if (current.status !== 'selection-required') {
    return current
  }

  const selected = current.options.find((option) => option.id === selectedId)

  if (selected) {
    return { status: 'resolved', administration: selected }
  }

  return { status: 'selection-required', options: current.options, select }
}
