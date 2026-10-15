import { useMutation, useQueryClient } from '@tanstack/react-query'
import { paymentRepository } from '../composition'
import { paymentQueryKeys } from './payment-query-keys'

export interface IssueReceiptMutationInput {
  administrationId: string
  rentalRelationshipId: string
  paymentId: string
}

/**
 * Issues a receipt for a CONFIRMED, at-least-partially-allocated payment via
 * issue_receipt (see PaymentRepository.issueReceipt's own doc comment -
 * can_manage_administration() and every business validation happen inside the
 * RPC). issue_receipt's only write is a single INSERT INTO receipts - it
 * never touches payments/charges/payment_allocations/charge_balances, so on
 * success this invalidates only this payment's own receipt sub-resource,
 * never paymentQueryKeys.list/allocations nor any charges key - there is
 * nothing there for issue_receipt to have changed (see this feature's own
 * scope notes on this increment's financial boundary).
 */
export function useIssueReceipt() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: IssueReceiptMutationInput) => paymentRepository.issueReceipt(input.paymentId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.receipt(variables.administrationId, variables.paymentId),
      })
    },
  })
}
