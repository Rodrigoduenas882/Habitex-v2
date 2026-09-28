import { useQuery } from '@tanstack/react-query'
import { paymentRepository } from '../composition'
import { paymentQueryKeys } from './payment-query-keys'

/**
 * Reads the single receipt (if any) issued for `paymentId`, mirroring
 * receipts' own UNIQUE(payment_id) constraint - 0 or 1 row, never more. Pass
 * `undefined` for either id while it isn't resolved yet - the query stays
 * disabled and never fetches until both are real (same disabled-until-
 * resolved pattern as usePaymentAllocations).
 */
export function usePaymentReceipt(administrationId: string | undefined, paymentId: string | undefined) {
  return useQuery({
    queryKey: paymentQueryKeys.receipt(administrationId ?? 'pending', paymentId ?? 'pending'),
    queryFn: () => {
      if (!paymentId) {
        throw new Error('usePaymentReceipt: called without a resolved paymentId')
      }
      return paymentRepository.getReceiptForPayment(paymentId)
    },
    enabled: Boolean(administrationId) && Boolean(paymentId),
  })
}
