import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ReportPaymentInput } from '../domain/payment.types'
import { paymentRepository } from '../composition'
import { paymentQueryKeys } from './payment-query-keys'

/**
 * Reports a payment via report_payment (see PaymentRepository.reportPayment's
 * own doc comment - can_view_relationship()/amount/proof-file validation all
 * happen inside the RPC). On success, invalidates this relationship's
 * payments list so the newly-reported row shows up without a manual refetch.
 */
export function useReportPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ReportPaymentInput) => paymentRepository.reportPayment(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.list(variables.administrationId, variables.rentalRelationshipId),
      })
    },
  })
}
