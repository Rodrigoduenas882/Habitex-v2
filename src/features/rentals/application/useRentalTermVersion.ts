import { useQuery } from '@tanstack/react-query'
import { rentalTermsRepository } from '../composition'
import { rentalQueryKeys } from './rental-query-keys'

/**
 * The current (only, for this increment - see RentalTermsRepository's own
 * doc comment) RentalTermVersion of `relationshipId`, or null if none has
 * been created yet. Pass undefined for either id while it isn't resolved -
 * the query stays disabled and never fetches until both are real (same
 * pattern as useSubscription's enabled: Boolean(...)).
 */
export function useRentalTermVersion(administrationId: string | undefined, relationshipId: string | undefined) {
  return useQuery({
    queryKey: rentalQueryKeys.terms(administrationId ?? 'pending', relationshipId ?? 'pending'),
    queryFn: () => {
      if (!relationshipId) {
        throw new Error('useRentalTermVersion: called without a resolved relationshipId')
      }
      return rentalTermsRepository.getCurrent(relationshipId)
    },
    enabled: Boolean(administrationId) && Boolean(relationshipId),
  })
}
