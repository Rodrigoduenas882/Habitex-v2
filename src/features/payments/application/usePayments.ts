import { useQuery } from '@tanstack/react-query'
import { paymentRepository } from '../composition'
import { paymentQueryKeys } from './payment-query-keys'

/**
 * Lists every payment of `rentalRelationshipId`. Pass `undefined` for either
 * id while it isn't resolved yet - the query stays disabled and never
 * fetches until both are real (same pattern as useCharges).
 */
export function usePayments(administrationId: string | undefined, rentalRelationshipId: string | undefined) {
  return useQuery({
    queryKey: paymentQueryKeys.list(administrationId ?? 'pending', rentalRelationshipId ?? 'pending'),
    queryFn: () => {
      if (!rentalRelationshipId) {
        throw new Error('usePayments: called without a resolved rentalRelationshipId')
      }
      return paymentRepository.listByRelationship(rentalRelationshipId)
    },
    enabled: Boolean(administrationId) && Boolean(rentalRelationshipId),
  })
}
