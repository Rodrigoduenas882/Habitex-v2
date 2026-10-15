import { useQuery } from '@tanstack/react-query'
import { paymentRepository } from '../composition'
import { paymentQueryKeys } from './payment-query-keys'

/**
 * Lists every allocation of `paymentId`. Pass `undefined` for either id while
 * it isn't resolved yet - the query stays disabled and never fetches until
 * both are real (same disabled-until-resolved pattern as usePayments).
 */
export function usePaymentAllocations(administrationId: string | undefined, paymentId: string | undefined) {
  return useQuery({
    queryKey: paymentQueryKeys.allocations(administrationId ?? 'pending', paymentId ?? 'pending'),
    queryFn: () => {
      if (!paymentId) {
        throw new Error('usePaymentAllocations: called without a resolved paymentId')
      }
      return paymentRepository.listAllocationsForPayment(paymentId)
    },
    enabled: Boolean(administrationId) && Boolean(paymentId),
  })
}
