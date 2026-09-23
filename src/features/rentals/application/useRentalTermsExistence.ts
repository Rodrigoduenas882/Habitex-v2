import { useQuery } from '@tanstack/react-query'
import { rentalTermsRepository } from '../composition'
import { rentalQueryKeys } from './rental-query-keys'

/**
 * The subset of `rentalRelationshipIds` that already have a term version -
 * the precise, non-heuristic "is this DRAFT rental ready to activate"
 * signal (see RentalTermsRepository.listRelationshipIdsWithTerms's own doc
 * comment). Scoped by administrationId only (rentalQueryKeys.termsExistence)
 * - `rentalRelationshipIds` is a plain argument to the queryFn (re-derived
 * fresh from the caller's already-fetched rentals list on every render), not
 * part of the query key. This is deliberate, not an oversight: the key is a
 * child of rentalQueryKeys.list(administrationId) (same array prefix), so
 * every existing invalidateQueries({ queryKey: rentalQueryKeys.list(...) })
 * call already in this feature (useCreateRentalDraft, useActivateRental,
 * useSaveRentalTerms) cascades to this query too via TanStack Query's
 * default prefix matching - no extra invalidation wiring needed here, and
 * the refetch it triggers always runs with each mounted caller's current
 * `rentalRelationshipIds` closure, never a stale one.
 *
 * Disabled entirely (no network call) unless administrationId is resolved
 * AND there's at least one id to check - an empty array has nothing to ask
 * about, same principle as useRentalTermVersion's enabled: Boolean(...).
 */
export function useRentalTermsExistence(administrationId: string | undefined, rentalRelationshipIds: string[]) {
  return useQuery({
    queryKey: rentalQueryKeys.termsExistence(administrationId ?? 'pending'),
    queryFn: () => rentalTermsRepository.listRelationshipIdsWithTerms(rentalRelationshipIds),
    enabled: Boolean(administrationId) && rentalRelationshipIds.length > 0,
  })
}
