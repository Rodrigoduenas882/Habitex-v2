import { useProperties } from '@/features/properties/application/useProperties'
import { useRentals } from '@/features/rentals/application/useRentals'

export type DashboardLifecycleState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'new-owner' }
  | { status: 'has-properties' }
  | { status: 'has-rentals' }

/**
 * Resolves which first-run Dashboard state to show, per INC-DASH-01's Estado
 * A/B/C split: 'new-owner' (zero properties), 'has-properties' (at least one
 * property, zero rentals - Estado B), 'has-rentals' (at least one rental -
 * the existing real Dashboard, unchanged). Pure derivation over
 * useProperties/useRentals - no new query, no new repository.
 *
 * Fail-closed ordering, deliberately checked in this order:
 * 1. loading wins over everything else - either query still pending means
 *    the real state isn't known yet, never guessed as 'new-owner'.
 * 2. error wins over 'new-owner' - a failed properties/rentals fetch must
 *    never be confused with "legitimately zero properties" (that would hide
 *    a real failure behind a cheerful onboarding screen).
 * Only once both queries have resolved successfully does an empty
 * properties/rentals array mean what it actually means.
 */
export function useDashboardLifecycleState(administrationId: string): DashboardLifecycleState {
  const properties = useProperties(administrationId)
  const rentals = useRentals(administrationId)

  if (properties.isLoading || rentals.isLoading) {
    return { status: 'loading' }
  }

  if (properties.isError || rentals.isError) {
    return { status: 'error' }
  }

  if ((properties.data?.length ?? 0) === 0) {
    return { status: 'new-owner' }
  }

  if ((rentals.data?.length ?? 0) === 0) {
    return { status: 'has-properties' }
  }

  return { status: 'has-rentals' }
}
