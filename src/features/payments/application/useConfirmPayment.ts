import { useMutation, useQueryClient } from '@tanstack/react-query'
import { paymentRepository } from '../composition'
import { paymentQueryKeys } from './payment-query-keys'

export interface ConfirmPaymentInput {
  paymentId: string
  administrationId: string
  rentalRelationshipId: string
}

/**
 * Confirms a payment via confirm_payment (see PaymentRepository.
 * confirmPayment's own doc comment - can_manage_administration() and the
 * REPORTED -> CONFIRMED transition both happen inside the RPC). On success,
 * invalidates this relationship's payments list using the passed
 * administrationId/rentalRelationshipId (the RPC only takes the paymentId).
 */
export function useConfirmPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ConfirmPaymentInput) => paymentRepository.confirmPayment(input.paymentId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.list(variables.administrationId, variables.rentalRelationshipId),
      })
    },
  })
}
