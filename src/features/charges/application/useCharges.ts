import { useQuery } from '@tanstack/react-query'
import { chargeRepository } from '../composition'
import { chargeQueryKeys } from './charge-query-keys'

/**
 * Lists every charge of `rentalRelationshipId`. Pass `undefined` for either
 * id while it isn't resolved yet - the query stays disabled and never
 * fetches until both are real (same pattern as useContracts).
 */
export function useCharges(administrationId: string | undefined, rentalRelationshipId: string | undefined) {
  return useQuery({
    queryKey: chargeQueryKeys.list(administrationId ?? 'pending', rentalRelationshipId ?? 'pending'),
    queryFn: () => {
      if (!rentalRelationshipId) {
        throw new Error('useCharges: called without a resolved rentalRelationshipId')
      }
      return chargeRepository.listByRelationship(rentalRelationshipId)
    },
    enabled: Boolean(administrationId) && Boolean(rentalRelationshipId),
  })
}
