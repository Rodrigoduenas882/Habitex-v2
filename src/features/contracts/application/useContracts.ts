import { useQuery } from '@tanstack/react-query'
import { contractRepository } from '../composition'
import { contractQueryKeys } from './contract-query-keys'

/**
 * Lists every contract of `rentalRelationshipId`. Pass `undefined` for
 * either id while it isn't resolved yet - the query stays disabled and
 * never fetches until both are real (same pattern as useRentalTermVersion).
 */
export function useContracts(administrationId: string | undefined, rentalRelationshipId: string | undefined) {
  return useQuery({
    queryKey: contractQueryKeys.list(administrationId ?? 'pending', rentalRelationshipId ?? 'pending'),
    queryFn: () => {
      if (!rentalRelationshipId) {
        throw new Error('useContracts: called without a resolved rentalRelationshipId')
      }
      return contractRepository.listByRelationship(rentalRelationshipId)
    },
    enabled: Boolean(administrationId) && Boolean(rentalRelationshipId),
  })
}
