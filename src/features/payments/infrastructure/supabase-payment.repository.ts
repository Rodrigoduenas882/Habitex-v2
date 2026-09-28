import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  PaymentRepositoryError,
  type AllocatePaymentInput,
  type Payment,
  type PaymentAllocation,
  type PaymentErrorCode,
  type PaymentMethod,
  type PaymentRepository,
  type PaymentStatus,
  type Receipt,
  type ReceiptStatus,
  type ReportPaymentInput,
} from '../domain/payment.types'

interface PaymentRow {
  id: string
  administration_id: string
  rental_relationship_id: string
  reported_by_person_id: string | null
  confirmed_by_person_id: string | null
  status: PaymentStatus
  amount: number
  currency: 'COP'
  payment_date: string
  payment_method: PaymentMethod | null
  external_reference: string | null
  proof_file_id: string | null
  notes: string | null
  reported_at: string
  confirmed_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

const PAYMENT_COLUMNS =
  'id, administration_id, rental_relationship_id, reported_by_person_id, confirmed_by_person_id, status, amount, currency, payment_date, payment_method, external_reference, proof_file_id, notes, reported_at, confirmed_at, rejected_at, rejection_reason, created_at, updated_at'

interface PaymentAllocationRow {
  id: string
  administration_id: string
  payment_id: string
  charge_id: string
  amount: number
  created_at: string
}

const PAYMENT_ALLOCATION_COLUMNS = 'id, administration_id, payment_id, charge_id, amount, created_at'

interface ReceiptRow {
  id: string
  administration_id: string
  rental_relationship_id: string
  payment_id: string
  receipt_number: number
  status: ReceiptStatus
  file_id: string | null
  issued_at: string
  voided_at: string | null
  void_reason: string | null
  created_at: string
}

const RECEIPT_COLUMNS =
  'id, administration_id, rental_relationship_id, payment_id, receipt_number, status, file_id, issued_at, voided_at, void_reason, created_at'

function toReceipt(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    administrationId: row.administration_id,
    rentalRelationshipId: row.rental_relationship_id,
    paymentId: row.payment_id,
    receiptNumber: row.receipt_number,
    status: row.status,
    fileId: row.file_id,
    issuedAt: row.issued_at,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    createdAt: row.created_at,
  }
}

function toPaymentAllocation(row: PaymentAllocationRow): PaymentAllocation {
  return {
    id: row.id,
    administrationId: row.administration_id,
    paymentId: row.payment_id,
    chargeId: row.charge_id,
    amount: row.amount,
    createdAt: row.created_at,
  }
}

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    administrationId: row.administration_id,
    rentalRelationshipId: row.rental_relationship_id,
    reportedByPersonId: row.reported_by_person_id,
    confirmedByPersonId: row.confirmed_by_person_id,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    paymentDate: row.payment_date,
    paymentMethod: row.payment_method,
    externalReference: row.external_reference,
    proofFileId: row.proof_file_id,
    notes: row.notes,
    reportedAt: row.reported_at,
    confirmedAt: row.confirmed_at,
    rejectedAt: row.rejected_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toReportPaymentRpcArgs(input: ReportPaymentInput) {
  return {
    p_relationship_id: input.rentalRelationshipId,
    p_amount: input.amount,
    p_payment_date: input.paymentDate,
    p_method: input.paymentMethod ?? null,
    p_reference: input.externalReference ?? null,
    p_proof_file_id: input.proofFileId ?? null,
    p_notes: input.notes ?? null,
  }
}

function toAllocatePaymentRpcArgs(input: AllocatePaymentInput) {
  return {
    p_payment_id: input.paymentId,
    p_charge_id: input.chargeId,
    p_amount: input.amount,
  }
}

/**
 * Translates a failed Supabase call (report_payment/confirm_payment/
 * reject_payment/allocate_payment/issue_receipt's RPC exception string, or a
 * raw Postgres error code from payment_allocations'/receipts' own
 * constraints) into our own PaymentRepositoryError - see PaymentErrorCode's
 * own doc comment for the exact mapping.
 *
 * A raw 23505 unique_violation is ambiguous on its own between
 * payment_allocations' own UNIQUE(payment_id, charge_id) (allocate_payment)
 * and receipts' own UNIQUE(payment_id) (issue_receipt) - both surface the
 * same error.code. Postgres' default constraint-naming convention embeds the
 * table name in the constraint name inside the error message (e.g.
 * "receipts_payment_id_key"), so that's what disambiguates the two here
 * rather than the call site (this function has no notion of which RPC
 * failed).
 */
function toPaymentRepositoryError(error: { message: string; code?: string }): PaymentRepositoryError {
  if (error.message === 'FORBIDDEN') {
    return new PaymentRepositoryError('forbidden', error)
  }

  if (error.message === 'INVALID_AMOUNT') {
    return new PaymentRepositoryError('invalid_amount', error)
  }

  if (error.message === 'INVALID_PROOF_FILE') {
    return new PaymentRepositoryError('invalid_proof_file', error)
  }

  if (error.message === 'PAYMENT_NOT_REPORTED') {
    return new PaymentRepositoryError('payment_not_reported', error)
  }

  if (error.message === 'PAYMENT_NOT_CONFIRMED') {
    return new PaymentRepositoryError('payment_not_confirmed', error)
  }

  if (error.message === 'ALLOCATION_SCOPE_MISMATCH') {
    return new PaymentRepositoryError('allocation_scope_mismatch', error)
  }

  if (error.message === 'ALLOCATION_EXCEEDS_PAYMENT') {
    return new PaymentRepositoryError('allocation_exceeds_payment', error)
  }

  if (error.message === 'ALLOCATION_EXCEEDS_CHARGE') {
    return new PaymentRepositoryError('allocation_exceeds_charge', error)
  }

  // issue_receipt only - the payment has no payment_allocations row of any
  // kind yet (full allocation is explicitly not required).
  if (error.message === 'PAYMENT_HAS_NO_ALLOCATIONS') {
    return new PaymentRepositoryError('payment_has_no_allocations', error)
  }

  // A raw Postgres unique_violation, either from payment_allocations' own
  // UNIQUE(payment_id, charge_id) (allocate_payment has no "increase an
  // existing allocation" path) or from receipts' own UNIQUE(payment_id)
  // (issue_receipt has no idempotency guard beyond this constraint) - see
  // this function's own doc comment for how the two are told apart.
  if (error.code === '23505') {
    if (error.message.includes('receipts_')) {
      return new PaymentRepositoryError('receipt_already_issued', error)
    }
    return new PaymentRepositoryError('duplicate_allocation', error)
  }

  // A raw Postgres check_violation from payment_allocations' own
  // CHECK(amount > 0) - allocate_payment never raises a named exception for
  // a non-positive amount, so this surfaces as the table's own constraint.
  if (error.code === '23514') {
    return new PaymentRepositoryError('invalid_amount', error)
  }

  // PAYMENT_OR_CHARGE_NOT_FOUND falls through to 'unknown' - unreachable
  // through this app's real flow, same unreachability convention already
  // used for report_payment's ACCOUNT_REQUIRED and charges'
  // RENTAL_RELATIONSHIP_NOT_FOUND (both ids always come from already-loaded
  // rows, and neither payments nor charges have any delete path).
  const unknownCode: PaymentErrorCode = 'unknown'
  return new PaymentRepositoryError(unknownCode, error)
}

export const supabasePaymentRepository: PaymentRepository = {
  async listByRelationship(rentalRelationshipId: string): Promise<Payment[]> {
    // Newest report first. No join, no allocations, no charge-derived data
    // of any kind - RLS (payments_select, can_view_relationship) remains the
    // real authority for scope.
    const { data, error } = await supabaseClient
      .from('payments')
      .select(PAYMENT_COLUMNS)
      .eq('rental_relationship_id', rentalRelationshipId)
      .order('reported_at', { ascending: false })

    if (error) {
      throw toPaymentRepositoryError(error)
    }

    return (data as PaymentRow[]).map(toPayment)
  },

  async reportPayment(input: ReportPaymentInput): Promise<Payment> {
    // can_view_relationship(), amount/proof-file validation and the INSERT
    // itself all happen inside the RPC (SECURITY DEFINER) - no direct
    // INSERT, ever (see PaymentRepository's own doc comment). Always sends
    // all 7 keys explicitly, mapping an unset optional to null, never
    // omitting a key.
    const response = await supabaseClient.rpc('report_payment', toReportPaymentRpcArgs(input))

    if (response.error) {
      throw toPaymentRepositoryError(response.error)
    }

    const row = response.data as PaymentRow | null
    if (!row) {
      throw new PaymentRepositoryError('unknown', new Error('report_payment returned no row'))
    }

    return toPayment(row)
  },

  async confirmPayment(paymentId: string): Promise<Payment> {
    // can_manage_administration() and the REPORTED -> CONFIRMED transition
    // both happen inside the RPC. No direct UPDATE, ever.
    const response = await supabaseClient.rpc('confirm_payment', { p_payment_id: paymentId })

    if (response.error) {
      throw toPaymentRepositoryError(response.error)
    }

    const row = response.data as PaymentRow | null
    if (!row) {
      throw new PaymentRepositoryError('unknown', new Error('confirm_payment returned no row'))
    }

    return toPayment(row)
  },

  async rejectPayment(paymentId: string): Promise<Payment> {
    // Same reasoning as confirmPayment - can_manage_administration() and the
    // REPORTED -> REJECTED transition both happen inside the RPC. No direct
    // UPDATE, ever.
    const response = await supabaseClient.rpc('reject_payment', { p_payment_id: paymentId })

    if (response.error) {
      throw toPaymentRepositoryError(response.error)
    }

    const row = response.data as PaymentRow | null
    if (!row) {
      throw new PaymentRepositoryError('unknown', new Error('reject_payment returned no row'))
    }

    return toPayment(row)
  },

  async listAllocationsForPayment(paymentId: string): Promise<PaymentAllocation[]> {
    // Oldest first - deterministic order matching creation order, useful for
    // a chronological allocation history if ever shown. RLS
    // (payment_allocations_select, can_view_relationship via the payment)
    // remains the real authority for scope.
    const { data, error } = await supabaseClient
      .from('payment_allocations')
      .select(PAYMENT_ALLOCATION_COLUMNS)
      .eq('payment_id', paymentId)
      .order('created_at', { ascending: true })

    if (error) {
      throw toPaymentRepositoryError(error)
    }

    return (data as PaymentAllocationRow[]).map(toPaymentAllocation)
  },

  async allocatePayment(input: AllocatePaymentInput): Promise<PaymentAllocation> {
    // can_manage_administration() and every business validation (payment
    // CONFIRMED, scope match, payment/charge remaining-amount limits) happen
    // inside the RPC and its BEFORE INSERT trigger. No direct INSERT, ever
    // (see PaymentRepository's own doc comment).
    const response = await supabaseClient.rpc('allocate_payment', toAllocatePaymentRpcArgs(input))

    if (response.error) {
      throw toPaymentRepositoryError(response.error)
    }

    const row = response.data as PaymentAllocationRow | null
    if (!row) {
      throw new PaymentRepositoryError('unknown', new Error('allocate_payment returned no row'))
    }

    return toPaymentAllocation(row)
  },

  async getReceiptForPayment(paymentId: string): Promise<Receipt | null> {
    // UNIQUE(payment_id) means 0-or-1 row - maybeSingle is the correct method
    // here, never .single(), which throws on zero rows. RLS (receipts_select,
    // can_view_relationship via rental_relationship_id) remains the real
    // authority for scope.
    const { data, error } = await supabaseClient
      .from('receipts')
      .select(RECEIPT_COLUMNS)
      .eq('payment_id', paymentId)
      .maybeSingle()

    if (error) {
      throw toPaymentRepositoryError(error)
    }

    return data ? toReceipt(data) : null
  },

  async issueReceipt(paymentId: string): Promise<Receipt> {
    // can_manage_administration(), the payment-CONFIRMED check and the
    // at-least-one-allocation check all happen inside the RPC - no direct
    // INSERT, ever (see PaymentRepository's own doc comment). issue_receipt
    // has no idempotency guard beyond receipts' own UNIQUE(payment_id) - a
    // second call for an already-receipted payment surfaces as a raw
    // unique_violation, mapped by toPaymentRepositoryError to
    // 'receipt_already_issued'.
    const response = await supabaseClient.rpc('issue_receipt', { p_payment_id: paymentId })

    if (response.error) {
      throw toPaymentRepositoryError(response.error)
    }

    const row = response.data as ReceiptRow | null
    if (!row) {
      throw new PaymentRepositoryError('unknown', new Error('issue_receipt returned no row'))
    }

    return toReceipt(row)
  },
}
