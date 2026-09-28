/**
 * payment_status, confirmed against the deployed schema (public.payments).
 * 'CANCELLED' exists only for exhaustiveness against the deployed enum - no
 * RPC or code path in this codebase ever produces it, and no UI action may
 * create it (report_payment always inserts REPORTED; confirm_payment/
 * reject_payment only ever move REPORTED -> CONFIRMED/REJECTED).
 */
export type PaymentStatus = 'REPORTED' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED'

/** payment_method, confirmed against the deployed schema (public.payments). */
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'DIGITAL_WALLET' | 'OTHER'

/**
 * A public.payments row, mirrored into camelCase domain shape. Every column
 * confirmed against the deployed schema - no field invented here.
 */
export interface Payment {
  id: string
  administrationId: string
  rentalRelationshipId: string
  reportedByPersonId: string | null
  confirmedByPersonId: string | null
  status: PaymentStatus
  amount: number
  currency: 'COP'
  paymentDate: string
  paymentMethod: PaymentMethod | null
  externalReference: string | null
  proofFileId: string | null
  notes: string | null
  reportedAt: string
  confirmedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
}

/** Input for PaymentRepository.reportPayment - mirrors report_payment's own optional args. */
export interface ReportPaymentInput {
  administrationId: string
  rentalRelationshipId: string
  amount: number
  paymentDate: string
  paymentMethod?: PaymentMethod
  externalReference?: string
  proofFileId?: string
  notes?: string
}

/**
 * Known, user-facing failure categories across report_payment/confirm_payment/
 * reject_payment - deliberately coarse, mirroring ChargeErrorCode/
 * ContractErrorCode's shape (see toPaymentRepositoryError's own doc comment
 * for the exact mapping):
 *
 * - 'forbidden' <- FORBIDDEN (relationship/payment not found, or the caller
 *   lacks the relevant can_view_relationship/can_manage_administration grant).
 * - 'invalid_amount' <- INVALID_AMOUNT (report_payment only).
 * - 'invalid_proof_file' <- INVALID_PROOF_FILE (report_payment only).
 * - 'payment_not_reported' <- PAYMENT_NOT_REPORTED (confirm_payment/
 *   reject_payment only - status isn't REPORTED anymore).
 * - 'unknown' <- everything else, including ACCOUNT_REQUIRED - unreachable
 *   through this frontend's own flows (every route that can reach payments
 *   sits behind the RequiresAccount router guard, same reasoning charges
 *   used to fold RENTAL_RELATIONSHIP_NOT_FOUND into 'unknown'), so it stays
 *   unmapped rather than getting a speculative dedicated code.
 */
export type PaymentErrorCode = 'forbidden' | 'invalid_amount' | 'invalid_proof_file' | 'payment_not_reported' | 'unknown'

export class PaymentRepositoryError extends Error {
  readonly code: PaymentErrorCode

  constructor(code: PaymentErrorCode, cause?: unknown) {
    super(`Payment repository error: ${code}`)
    this.name = 'PaymentRepositoryError'
    this.code = code
    this.cause = cause
  }
}

/**
 * public.payments port. Every write goes through an RPC (report_payment/
 * confirm_payment/reject_payment) - this port never issues a raw INSERT/
 * UPDATE/DELETE against public.payments, since the table is RLS-scoped to
 * SELECT only (payments_select, can_view_relationship). RLS remains the real
 * authority for both read and write; this port's typing is not a security
 * boundary. No payment_allocations/charges/charge_balances read exists
 * anywhere in this port - out of scope for this increment (see this
 * feature's own scope notes). No edit/delete/cancel transition exists
 * either - CANCELLED is never a reachable target here.
 */
export interface PaymentRepository {
  listByRelationship(rentalRelationshipId: string): Promise<Payment[]>
  reportPayment(input: ReportPaymentInput): Promise<Payment>
  confirmPayment(paymentId: string): Promise<Payment>
  rejectPayment(paymentId: string): Promise<Payment>
}
