import { useMutation, useQueryClient } from '@tanstack/react-query'
// Cross-feature import, explicitly human-authorized for this increment (see
// this hook's own doc comment) - reused exactly as exported, never modified.
import { chargeQueryKeys } from '@/features/charges/application/charge-query-keys'
import { paymentRepository } from '../composition'
import { paymentQueryKeys } from './payment-query-keys'

export interface AllocatePaymentMutationInput {
  administrationId: string
  rentalRelationshipId: string
  paymentId: string
  chargeId: string
  amount: number
}

/**
 * Allocates a confirmed payment against a charge via allocate_payment (see
 * PaymentRepository.allocatePayment's own doc comment - can_manage_
 * administration() and every business validation happen inside the RPC and
 * its trigger). On success, invalidates exactly two query keys: this
 * payment's own allocations sub-resource, and the relationship's charges
 * list (imported from features/charges' own chargeQueryKeys - allocating a
 * payment changes a charge's derived remaining balance, so its list must be
 * refetched too). Does not invalidate paymentQueryKeys.list - the payments
 * list itself doesn't change on allocation.
 */
export function useAllocatePayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AllocatePaymentMutationInput) =>
      paymentRepository.allocatePayment({ paymentId: input.paymentId, chargeId: input.chargeId, amount: input.amount }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.allocations(variables.administrationId, variables.paymentId),
      })
      void queryClient.invalidateQueries({
        queryKey: chargeQueryKeys.list(variables.administrationId, variables.rentalRelationshipId),
      })
    },
  })
}
