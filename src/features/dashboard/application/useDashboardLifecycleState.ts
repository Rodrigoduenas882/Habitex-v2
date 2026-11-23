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
 * property, no SUBSTANTIVE rental - Estado B), 'has-rentals' (at least one
 * substantive rental - the existing real Dashboard, unchanged). Pure
 * derivation over useProperties/useRentals - no new query, no new
 * repository.
 *
 * Product decision (approved after INC-DASH-01's functional validation -
 * confirmed live against a disposable stack that an administration with
 * only CANCELLED/ENDED rentals was being misclassified before this fix):
 * a rental only counts toward 'has-rentals' when its status is ACTIVE,
 * ENDING or ENDED. DRAFT and CANCELLED never do, on their own - a draft
 * that was never activated, or one that was cancelled, carries no real
 * financial/occupancy history, so surfacing the full KPI Dashboard for it
 * would just be the "wall of zeros" Estado B exists to avoid. ENDED is
 * deliberately included (unlike activeRelationshipCount's ACTIVE+ENDING-only
 * definition, a different, narrower concept used for the capacity gate) -
 * a rental that genuinely ran and ended still has real historical
 * administrative data (past charges/payments), so the owner keeps access to
 * the full Dashboard rather than being routed back to Estado B's onboarding
 * CTA. See DashboardContent's own comment for the INC-DASH-02 follow-up this
 * implies (an ENDED-only administration can legitimately see an all-zero
 * current-month/6-month view and needs a contextual message, not a bug fix
 * here).
 *
 * Fail-closed ordering, deliberately checked in this order:
 * 1. loading wins over everything else - either query still pending means
 *    the real state isn't known yet, never guessed as 'new-owner'.
 * 2. error wins over 'new-owner' - a failed properties/rentals fetch must
 *    never be confused with "legitimately zero properties" (that would hide
 *    a real failure behind a cheerful onboarding screen).
 * Only once both queries have resolved successfully does an empty/non-
 * substantive rentals array mean what it actually means.
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

  const hasSubstantiveRental = (rentals.data ?? []).some(
    (rental) => rental.status === 'ACTIVE' || rental.status === 'ENDING' || rental.status === 'ENDED',
  )
  if (!hasSubstantiveRental) {
    return { status: 'has-properties' }
  }

  return { status: 'has-rentals' }
}
