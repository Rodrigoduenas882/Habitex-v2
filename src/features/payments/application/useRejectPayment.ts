import { useMutation, useQueryClient } from '@tanstack/react-query'
import { paymentRepository } from '../composition'
import { paymentQueryKeys } from './payment-query-keys'

export interface RejectPaymentInput {
  paymentId: string
  administrationId: string
  rentalRelationshipId: string
}

/**
 * Rejects a payment via reject_payment (see PaymentRepository.rejectPayment's
 * own doc comment - can_manage_administration() and the REPORTED ->
 * REJECTED transition both happen inside the RPC). On success, invalidates
 * this relationship's payments list using the passed administrationId/
 * rentalRelationshipId (the RPC only takes the paymentId). Never touches
 * rejection_reason - same as the deployed RPC.
 */
export function useRejectPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: RejectPaymentInput) => paymentRepository.rejectPayment(input.paymentId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.list(variables.administrationId, variables.rentalRelationshipId),
      })
    },
  })
}
