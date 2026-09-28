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
 * reject_payment/allocate_payment - deliberately coarse, mirroring
 * ChargeErrorCode/ContractErrorCode's shape (see toPaymentRepositoryError's
 * own doc comment for the exact mapping):
 *
 * - 'forbidden' <- FORBIDDEN (relationship/payment not found, or the caller
 *   lacks the relevant can_view_relationship/can_manage_administration grant).
 * - 'invalid_amount' <- INVALID_AMOUNT (report_payment), and also reused for
 *   allocate_payment's own non-positive-amount case, which never raises a
 *   named exception - it surfaces as a raw Postgres check_violation
 *   (error.code === '23514') from payment_allocations' own CHECK(amount > 0).
 *   Same class of failure, so no second code.
 * - 'invalid_proof_file' <- INVALID_PROOF_FILE (report_payment only).
 * - 'payment_not_reported' <- PAYMENT_NOT_REPORTED (confirm_payment/
 *   reject_payment only - status isn't REPORTED anymore).
 * - 'payment_not_confirmed' <- PAYMENT_NOT_CONFIRMED (allocate_payment only -
 *   the target payment's status isn't CONFIRMED).
 * - 'allocation_scope_mismatch' <- ALLOCATION_SCOPE_MISMATCH (allocate_payment
 *   only - the charge's administration or rental_relationship_id doesn't
 *   match the payment's).
 * - 'allocation_exceeds_payment' <- ALLOCATION_EXCEEDS_PAYMENT (allocate_payment
 *   only - this payment's other allocations plus the new amount would exceed
 *   payment.amount).
 * - 'allocation_exceeds_charge' <- ALLOCATION_EXCEEDS_CHARGE (allocate_payment
 *   only - this charge's other allocations from CONFIRMED payments plus the
 *   new amount would exceed charge.amount).
 * - 'duplicate_allocation' <- a raw Postgres unique_violation
 *   (error.code === '23505') from payment_allocations' own
 *   UNIQUE(payment_id, charge_id) - allocate_payment has no "increase an
 *   existing allocation" path.
 * - 'payment_has_no_allocations' <- PAYMENT_HAS_NO_ALLOCATIONS (issue_receipt
 *   only - the payment has no payment_allocations row of any kind yet; full
 *   allocation is explicitly not required, a single partial allocation of any
 *   amount already satisfies this).
 * - 'receipt_already_issued' <- a raw Postgres unique_violation
 *   (error.code === '23505') from receipts' own UNIQUE(payment_id) -
 *   issue_receipt has no idempotency guard beyond that constraint, so a
 *   second call for an already-receipted payment surfaces as this raw
 *   constraint rather than a named exception.
 * - 'unknown' <- everything else, including ACCOUNT_REQUIRED and
 *   PAYMENT_OR_CHARGE_NOT_FOUND - both unreachable through this frontend's own
 *   flows (every route that can reach payments sits behind the
 *   RequiresAccount router guard, and both payment_id/charge_id always come
 *   from already-loaded rows with no delete path anywhere - same reasoning
 *   charges used to fold RENTAL_RELATIONSHIP_NOT_FOUND into 'unknown'), so it
 *   stays unmapped rather than getting a speculative dedicated code.
 */
export type PaymentErrorCode =
  | 'forbidden'
  | 'invalid_amount'
  | 'invalid_proof_file'
  | 'payment_not_reported'
  | 'payment_not_confirmed'
  | 'allocation_scope_mismatch'
  | 'allocation_exceeds_payment'
  | 'allocation_exceeds_charge'
  | 'duplicate_allocation'
  | 'payment_has_no_allocations'
  | 'receipt_already_issued'
  | 'unknown'

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
 * A public.payment_allocations row, mirrored into camelCase domain shape.
 * Every column confirmed against the deployed schema - no field invented
 * here. There is no edit/delete/reversal capability anywhere for this table
 * (no RPC, no RLS UPDATE/DELETE policy) - once created, an allocation is
 * immutable and permanent.
 */
export interface PaymentAllocation {
  id: string
  administrationId: string
  paymentId: string
  chargeId: string
  amount: number
  createdAt: string
}

/** Input for PaymentRepository.allocatePayment - mirrors allocate_payment's own args. */
export interface AllocatePaymentInput {
  paymentId: string
  chargeId: string
  amount: number
}

/**
 * receipt_status, confirmed against the deployed schema (public.receipts).
 * 'VOIDED' exists only for exhaustiveness against the deployed enum - no RPC
 * or RLS policy in this codebase ever produces it (issue_receipt always
 * inserts ISSUED, and there is no void/reissue/edit RPC anywhere for this
 * table), and no UI action may create it.
 */
export type ReceiptStatus = 'ISSUED' | 'VOIDED'

/**
 * A public.receipts row, mirrored into camelCase domain shape. Every column
 * confirmed against the deployed schema - no field invented here. `fileId`
 * will always be `null` in practice today - no write path (issue_receipt or
 * otherwise) ever sets it, even though FilePurpose.RECEIPT/
 * FileStorageBucket.'receipts' already exist in features/documents' own
 * domain types; wiring that up is explicitly out of scope for this
 * increment (see this feature's own scope notes). `voidedAt`/`voidReason`
 * mirror ReceiptStatus's own 'VOIDED' - never populated in practice.
 */
export interface Receipt {
  id: string
  administrationId: string
  rentalRelationshipId: string
  paymentId: string
  receiptNumber: number
  status: ReceiptStatus
  fileId: string | null
  issuedAt: string
  voidedAt: string | null
  voidReason: string | null
  createdAt: string
}

/**
 * public.payments port. Every write goes through an RPC (report_payment/
 * confirm_payment/reject_payment/allocate_payment/issue_receipt) - this port
 * never issues a raw INSERT/UPDATE/DELETE against public.payments, since the
 * table is RLS-scoped to SELECT only (payments_select, can_view_relationship).
 * RLS remains the real authority for both read and write; this port's typing
 * is not a security boundary. No edit/delete/cancel transition exists for
 * payments - CANCELLED is never a reachable target here.
 *
 * allocatePayment (via the allocate_payment RPC) is the only write path
 * against public.payment_allocations - that table has no edit/delete/
 * reversal capability anywhere (no RPC, no RLS UPDATE/DELETE policy), so this
 * port never issues a raw INSERT/UPDATE/DELETE against it either. No
 * charges/charge_balances read exists anywhere in this port - out of scope
 * for this increment (see this feature's own scope notes).
 *
 * issueReceipt (via the issue_receipt RPC) is the only write path against
 * public.receipts - that table has no edit/void/reissue capability anywhere
 * (no RPC, no RLS INSERT/UPDATE/DELETE policy besides the one this RPC uses
 * SECURITY DEFINER to bypass), so this port never issues a raw INSERT/UPDATE/
 * DELETE against it either.
 */
export interface PaymentRepository {
  listByRelationship(rentalRelationshipId: string): Promise<Payment[]>
  reportPayment(input: ReportPaymentInput): Promise<Payment>
  confirmPayment(paymentId: string): Promise<Payment>
  rejectPayment(paymentId: string): Promise<Payment>
  listAllocationsForPayment(paymentId: string): Promise<PaymentAllocation[]>
  allocatePayment(input: AllocatePaymentInput): Promise<PaymentAllocation>
  getReceiptForPayment(paymentId: string): Promise<Receipt | null>
  issueReceipt(paymentId: string): Promise<Receipt>
}
