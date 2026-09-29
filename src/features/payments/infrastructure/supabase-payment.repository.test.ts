import { describe, expect, it, vi } from 'vitest'
import { PaymentRepositoryError } from '../domain/payment.types'

const { order, eq, maybeSingle, from, rpc } = vi.hoisted(() => {
  const order = vi.fn()
  const maybeSingle = vi.fn()
  // .eq() also chains to itself - listReportedByAdministration calls
  // .eq('administration_id', ...).eq('status', ...).order(...).
  const eq = vi.fn((_column: string, _value: string) => ({ order, maybeSingle, eq }))
  const select = vi.fn((_columns: string) => ({ eq }))

  const from = vi.fn((table: string) => {
    if (table === 'payments') return { select }
    if (table === 'payment_allocations') return { select }
    if (table === 'receipts') return { select }
    throw new Error(`supabase-payment.repository.test: unexpected table "${table}"`)
  })
  const rpc = vi.fn()

  return { order, eq, maybeSingle, from, rpc }
})

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: { from, rpc },
}))

import { supabasePaymentRepository } from './supabase-payment.repository'

const PAYMENT_ROW_REPORTED = {
  id: 'payment-1',
  administration_id: 'admin-1',
  rental_relationship_id: 'rel-1',
  reported_by_person_id: 'person-1',
  confirmed_by_person_id: null,
  status: 'REPORTED' as const,
  amount: 1_000_000,
  currency: 'COP' as const,
  payment_date: '2026-01-05',
  payment_method: 'BANK_TRANSFER' as const,
  external_reference: 'ref-123',
  proof_file_id: 'file-1',
  notes: 'Pago de enero',
  reported_at: '2026-01-05T10:00:00Z',
  confirmed_at: null,
  rejected_at: null,
  rejection_reason: null,
  created_at: '2026-01-05T10:00:00Z',
  updated_at: '2026-01-05T10:00:00Z',
}

const PAYMENT_ROW_CONFIRMED = {
  ...PAYMENT_ROW_REPORTED,
  id: 'payment-2',
  status: 'CONFIRMED' as const,
  confirmed_by_person_id: 'person-2',
  confirmed_at: '2026-01-06T10:00:00Z',
}

const PAYMENT_DOMAIN_REPORTED = {
  id: 'payment-1',
  administrationId: 'admin-1',
  rentalRelationshipId: 'rel-1',
  reportedByPersonId: 'person-1',
  confirmedByPersonId: null,
  status: 'REPORTED',
  amount: 1_000_000,
  currency: 'COP',
  paymentDate: '2026-01-05',
  paymentMethod: 'BANK_TRANSFER',
  externalReference: 'ref-123',
  proofFileId: 'file-1',
  notes: 'Pago de enero',
  reportedAt: '2026-01-05T10:00:00Z',
  confirmedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  createdAt: '2026-01-05T10:00:00Z',
  updatedAt: '2026-01-05T10:00:00Z',
}

const PAYMENT_ALLOCATION_ROW = {
  id: 'allocation-1',
  administration_id: 'admin-1',
  payment_id: 'payment-1',
  charge_id: 'charge-1',
  amount: 500_000,
  created_at: '2026-01-06T10:00:00Z',
}

const PAYMENT_ALLOCATION_DOMAIN = {
  id: 'allocation-1',
  administrationId: 'admin-1',
  paymentId: 'payment-1',
  chargeId: 'charge-1',
  amount: 500_000,
  createdAt: '2026-01-06T10:00:00Z',
}

const RECEIPT_ROW = {
  id: 'receipt-1',
  administration_id: 'admin-1',
  rental_relationship_id: 'rel-1',
  payment_id: 'payment-1',
  receipt_number: 42,
  status: 'ISSUED' as const,
  file_id: null,
  issued_at: '2026-01-07T10:00:00Z',
  voided_at: null,
  void_reason: null,
  created_at: '2026-01-07T10:00:00Z',
}

const RECEIPT_DOMAIN = {
  id: 'receipt-1',
  administrationId: 'admin-1',
  rentalRelationshipId: 'rel-1',
  paymentId: 'payment-1',
  receiptNumber: 42,
  status: 'ISSUED',
  fileId: null,
  issuedAt: '2026-01-07T10:00:00Z',
  voidedAt: null,
  voidReason: null,
  createdAt: '2026-01-07T10:00:00Z',
}

describe('supabasePaymentRepository.listByRelationship', () => {
  it('issues a single SELECT against payments, scoped by rental_relationship_id, ordered newest-report-first', async () => {
    order.mockResolvedValueOnce({ data: [PAYMENT_ROW_REPORTED], error: null })

    await supabasePaymentRepository.listByRelationship('rel-1')

    expect(from).toHaveBeenCalledWith('payments')
    expect(eq).toHaveBeenCalledWith('rental_relationship_id', 'rel-1')
    expect(order).toHaveBeenCalledWith('reported_at', { ascending: false })
  })

  it('maps a payments row into camelCase domain shape', async () => {
    order.mockResolvedValueOnce({ data: [PAYMENT_ROW_REPORTED], error: null })

    const result = await supabasePaymentRepository.listByRelationship('rel-1')

    expect(result).toEqual([PAYMENT_DOMAIN_REPORTED])
  })

  it('wraps a Supabase failure in PaymentRepositoryError with code unknown', async () => {
    order.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    const error = await supabasePaymentRepository.listByRelationship('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('unknown')
  })
})

describe('supabasePaymentRepository.reportPayment', () => {
  it('sends all 7 RPC keys explicitly for a minimal input (only required fields), mapping unset optionals to null', async () => {
    rpc.mockResolvedValueOnce({ data: PAYMENT_ROW_REPORTED, error: null })

    await supabasePaymentRepository.reportPayment({
      administrationId: 'admin-1',
      rentalRelationshipId: 'rel-1',
      amount: 1_000_000,
      paymentDate: '2026-01-05',
    })

    expect(rpc).toHaveBeenCalledWith('report_payment', {
      p_relationship_id: 'rel-1',
      p_amount: 1_000_000,
      p_payment_date: '2026-01-05',
      p_method: null,
      p_reference: null,
      p_proof_file_id: null,
      p_notes: null,
    })
    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(Object.keys(args)).toEqual([
      'p_relationship_id',
      'p_amount',
      'p_payment_date',
      'p_method',
      'p_reference',
      'p_proof_file_id',
      'p_notes',
    ])
  })

  it('sends all 7 RPC keys explicitly for a full input (every optional field set)', async () => {
    rpc.mockResolvedValueOnce({ data: PAYMENT_ROW_REPORTED, error: null })

    await supabasePaymentRepository.reportPayment({
      administrationId: 'admin-1',
      rentalRelationshipId: 'rel-1',
      amount: 1_000_000,
      paymentDate: '2026-01-05',
      paymentMethod: 'BANK_TRANSFER',
      externalReference: 'ref-123',
      proofFileId: 'file-1',
      notes: 'Pago de enero',
    })

    expect(rpc).toHaveBeenCalledWith('report_payment', {
      p_relationship_id: 'rel-1',
      p_amount: 1_000_000,
      p_payment_date: '2026-01-05',
      p_method: 'BANK_TRANSFER',
      p_reference: 'ref-123',
      p_proof_file_id: 'file-1',
      p_notes: 'Pago de enero',
    })
    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(Object.keys(args)).toEqual([
      'p_relationship_id',
      'p_amount',
      'p_payment_date',
      'p_method',
      'p_reference',
      'p_proof_file_id',
      'p_notes',
    ])
  })

  it('maps the returned single row to domain shape', async () => {
    rpc.mockResolvedValueOnce({ data: PAYMENT_ROW_REPORTED, error: null })

    const result = await supabasePaymentRepository.reportPayment({
      administrationId: 'admin-1',
      rentalRelationshipId: 'rel-1',
      amount: 1_000_000,
      paymentDate: '2026-01-05',
    })

    expect(result).toEqual(PAYMENT_DOMAIN_REPORTED)
  })

  it('throws PaymentRepositoryError with code unknown when the RPC returns no row (defensive, unreachable per the deployed function body)', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })

    const error = await supabasePaymentRepository
      .reportPayment({
        administrationId: 'admin-1',
        rentalRelationshipId: 'rel-1',
        amount: 1_000_000,
        paymentDate: '2026-01-05',
      })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('unknown')
  })

  it('maps FORBIDDEN to code forbidden', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'FORBIDDEN' } })

    const error = await supabasePaymentRepository
      .reportPayment({ administrationId: 'admin-1', rentalRelationshipId: 'rel-1', amount: 1_000_000, paymentDate: '2026-01-05' })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('forbidden')
  })

  it('maps INVALID_AMOUNT to code invalid_amount', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'INVALID_AMOUNT' } })

    const error = await supabasePaymentRepository
      .reportPayment({ administrationId: 'admin-1', rentalRelationshipId: 'rel-1', amount: -1, paymentDate: '2026-01-05' })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('invalid_amount')
  })

  it('maps INVALID_PROOF_FILE to code invalid_proof_file', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'INVALID_PROOF_FILE' } })

    const error = await supabasePaymentRepository
      .reportPayment({
        administrationId: 'admin-1',
        rentalRelationshipId: 'rel-1',
        amount: 1_000_000,
        paymentDate: '2026-01-05',
        proofFileId: 'not-scoped',
      })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('invalid_proof_file')
  })

  it('maps ACCOUNT_REQUIRED (unreachable in this app - every payments route sits behind the RequiresAccount router guard) to code unknown', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'ACCOUNT_REQUIRED' } })

    const error = await supabasePaymentRepository
      .reportPayment({ administrationId: 'admin-1', rentalRelationshipId: 'rel-1', amount: 1_000_000, paymentDate: '2026-01-05' })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('unknown')
  })

  it('maps any other unmapped exception string to code unknown', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'SOMETHING_ELSE' } })

    const error = await supabasePaymentRepository
      .reportPayment({ administrationId: 'admin-1', rentalRelationshipId: 'rel-1', amount: 1_000_000, paymentDate: '2026-01-05' })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('unknown')
  })
})

describe('supabasePaymentRepository.confirmPayment', () => {
  it('calls confirm_payment with only p_payment_id', async () => {
    rpc.mockResolvedValueOnce({ data: PAYMENT_ROW_CONFIRMED, error: null })

    await supabasePaymentRepository.confirmPayment('payment-2')

    expect(rpc).toHaveBeenCalledWith('confirm_payment', { p_payment_id: 'payment-2' })
    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(Object.keys(args)).toEqual(['p_payment_id'])
  })

  it('maps the returned single row to domain shape', async () => {
    rpc.mockResolvedValueOnce({ data: PAYMENT_ROW_CONFIRMED, error: null })

    const result = await supabasePaymentRepository.confirmPayment('payment-2')

    expect(result.status).toBe('CONFIRMED')
    expect(result.confirmedByPersonId).toBe('person-2')
  })

  it('maps FORBIDDEN to code forbidden', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'FORBIDDEN' } })

    const error = await supabasePaymentRepository.confirmPayment('payment-2').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('forbidden')
  })

  it('maps PAYMENT_NOT_REPORTED to code payment_not_reported', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'PAYMENT_NOT_REPORTED' } })

    const error = await supabasePaymentRepository.confirmPayment('payment-2').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('payment_not_reported')
  })

  it('maps any other unmapped exception string to code unknown', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'SOMETHING_ELSE' } })

    const error = await supabasePaymentRepository.confirmPayment('payment-2').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('unknown')
  })

  it('throws PaymentRepositoryError with code unknown when the RPC returns no row (defensive)', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })

    const error = await supabasePaymentRepository.confirmPayment('payment-2').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('unknown')
  })
})

describe('supabasePaymentRepository.rejectPayment', () => {
  it('calls reject_payment with only p_payment_id', async () => {
    rpc.mockResolvedValueOnce({ data: { ...PAYMENT_ROW_REPORTED, status: 'REJECTED', rejected_at: '2026-01-07T10:00:00Z' }, error: null })

    await supabasePaymentRepository.rejectPayment('payment-1')

    expect(rpc).toHaveBeenCalledWith('reject_payment', { p_payment_id: 'payment-1' })
    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(Object.keys(args)).toEqual(['p_payment_id'])
  })

  it('maps the returned single row to domain shape', async () => {
    rpc.mockResolvedValueOnce({ data: { ...PAYMENT_ROW_REPORTED, status: 'REJECTED', rejected_at: '2026-01-07T10:00:00Z' }, error: null })

    const result = await supabasePaymentRepository.rejectPayment('payment-1')

    expect(result.status).toBe('REJECTED')
    expect(result.rejectedAt).toBe('2026-01-07T10:00:00Z')
  })

  it('maps FORBIDDEN to code forbidden', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'FORBIDDEN' } })

    const error = await supabasePaymentRepository.rejectPayment('payment-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('forbidden')
  })

  it('maps PAYMENT_NOT_REPORTED to code payment_not_reported', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'PAYMENT_NOT_REPORTED' } })

    const error = await supabasePaymentRepository.rejectPayment('payment-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('payment_not_reported')
  })

  it('maps any other unmapped exception string to code unknown', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'SOMETHING_ELSE' } })

    const error = await supabasePaymentRepository.rejectPayment('payment-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('unknown')
  })

  it('throws PaymentRepositoryError with code unknown when the RPC returns no row (defensive)', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })

    const error = await supabasePaymentRepository.rejectPayment('payment-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('unknown')
  })
})

describe('supabasePaymentRepository.listAllocationsForPayment', () => {
  it('issues a single SELECT against payment_allocations, scoped by payment_id, ordered oldest-first', async () => {
    order.mockResolvedValueOnce({ data: [PAYMENT_ALLOCATION_ROW], error: null })

    await supabasePaymentRepository.listAllocationsForPayment('payment-1')

    expect(from).toHaveBeenCalledWith('payment_allocations')
    expect(eq).toHaveBeenCalledWith('payment_id', 'payment-1')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true })
  })

  it('maps a payment_allocations row into camelCase domain shape', async () => {
    order.mockResolvedValueOnce({ data: [PAYMENT_ALLOCATION_ROW], error: null })

    const result = await supabasePaymentRepository.listAllocationsForPayment('payment-1')

    expect(result).toEqual([PAYMENT_ALLOCATION_DOMAIN])
  })

  it('wraps a Supabase failure in PaymentRepositoryError with code unknown', async () => {
    order.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    const error = await supabasePaymentRepository.listAllocationsForPayment('payment-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('unknown')
  })
})

describe('supabasePaymentRepository.allocatePayment', () => {
  it('calls allocate_payment with exactly p_payment_id/p_charge_id/p_amount', async () => {
    rpc.mockResolvedValueOnce({ data: PAYMENT_ALLOCATION_ROW, error: null })

    await supabasePaymentRepository.allocatePayment({ paymentId: 'payment-1', chargeId: 'charge-1', amount: 500_000 })

    expect(rpc).toHaveBeenCalledWith('allocate_payment', {
      p_payment_id: 'payment-1',
      p_charge_id: 'charge-1',
      p_amount: 500_000,
    })
    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(Object.keys(args)).toEqual(['p_payment_id', 'p_charge_id', 'p_amount'])
  })

  it('maps the returned single row to domain shape', async () => {
    rpc.mockResolvedValueOnce({ data: PAYMENT_ALLOCATION_ROW, error: null })

    const result = await supabasePaymentRepository.allocatePayment({ paymentId: 'payment-1', chargeId: 'charge-1', amount: 500_000 })

    expect(result).toEqual(PAYMENT_ALLOCATION_DOMAIN)
  })

  it('throws PaymentRepositoryError with code unknown when the RPC returns no row (defensive)', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })

    const error = await supabasePaymentRepository
      .allocatePayment({ paymentId: 'payment-1', chargeId: 'charge-1', amount: 500_000 })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('unknown')
  })

  it('maps PAYMENT_NOT_CONFIRMED to code payment_not_confirmed', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'PAYMENT_NOT_CONFIRMED' } })

    const error = await supabasePaymentRepository
      .allocatePayment({ paymentId: 'payment-1', chargeId: 'charge-1', amount: 500_000 })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('payment_not_confirmed')
  })

  it('maps ALLOCATION_SCOPE_MISMATCH to code allocation_scope_mismatch', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'ALLOCATION_SCOPE_MISMATCH' } })

    const error = await supabasePaymentRepository
      .allocatePayment({ paymentId: 'payment-1', chargeId: 'charge-1', amount: 500_000 })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('allocation_scope_mismatch')
  })

  it('maps ALLOCATION_EXCEEDS_PAYMENT to code allocation_exceeds_payment', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'ALLOCATION_EXCEEDS_PAYMENT' } })

    const error = await supabasePaymentRepository
      .allocatePayment({ paymentId: 'payment-1', chargeId: 'charge-1', amount: 500_000 })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('allocation_exceeds_payment')
  })

  it('maps ALLOCATION_EXCEEDS_CHARGE to code allocation_exceeds_charge', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'ALLOCATION_EXCEEDS_CHARGE' } })

    const error = await supabasePaymentRepository
      .allocatePayment({ paymentId: 'payment-1', chargeId: 'charge-1', amount: 500_000 })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('allocation_exceeds_charge')
  })

  it('maps a raw Postgres unique_violation (23505) to code duplicate_allocation', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } })

    const error = await supabasePaymentRepository
      .allocatePayment({ paymentId: 'payment-1', chargeId: 'charge-1', amount: 500_000 })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('duplicate_allocation')
  })

  it('maps a raw Postgres check_violation (23514) to code invalid_amount', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'new row violates check constraint', code: '23514' } })

    const error = await supabasePaymentRepository
      .allocatePayment({ paymentId: 'payment-1', chargeId: 'charge-1', amount: -1 })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('invalid_amount')
  })

  it('maps PAYMENT_OR_CHARGE_NOT_FOUND (unreachable in this app - both ids always come from already-loaded rows with no delete path) to code unknown', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'PAYMENT_OR_CHARGE_NOT_FOUND' } })

    const error = await supabasePaymentRepository
      .allocatePayment({ paymentId: 'payment-1', chargeId: 'charge-1', amount: 500_000 })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('unknown')
  })
})

describe('supabasePaymentRepository.getReceiptForPayment', () => {
  it('issues a single SELECT against receipts, scoped by payment_id, using maybeSingle', async () => {
    maybeSingle.mockResolvedValueOnce({ data: RECEIPT_ROW, error: null })

    await supabasePaymentRepository.getReceiptForPayment('payment-1')

    expect(from).toHaveBeenCalledWith('receipts')
    expect(eq).toHaveBeenCalledWith('payment_id', 'payment-1')
    expect(maybeSingle).toHaveBeenCalledTimes(1)
  })

  it('maps a receipts row into camelCase domain shape', async () => {
    maybeSingle.mockResolvedValueOnce({ data: RECEIPT_ROW, error: null })

    const result = await supabasePaymentRepository.getReceiptForPayment('payment-1')

    expect(result).toEqual(RECEIPT_DOMAIN)
  })

  it('returns null when no receipt exists yet, rather than throwing', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await supabasePaymentRepository.getReceiptForPayment('payment-1')

    expect(result).toBeNull()
  })

  it('wraps a genuine query failure in PaymentRepositoryError with code unknown', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    const error = await supabasePaymentRepository.getReceiptForPayment('payment-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('unknown')
  })
})

describe('supabasePaymentRepository.issueReceipt', () => {
  it('calls issue_receipt with exactly p_payment_id', async () => {
    rpc.mockResolvedValueOnce({ data: RECEIPT_ROW, error: null })

    await supabasePaymentRepository.issueReceipt('payment-1')

    expect(rpc).toHaveBeenCalledWith('issue_receipt', { p_payment_id: 'payment-1' })
    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(Object.keys(args)).toEqual(['p_payment_id'])
  })

  it('maps the returned single row to domain shape', async () => {
    rpc.mockResolvedValueOnce({ data: RECEIPT_ROW, error: null })

    const result = await supabasePaymentRepository.issueReceipt('payment-1')

    expect(result).toEqual(RECEIPT_DOMAIN)
  })

  it('throws PaymentRepositoryError with code unknown when the RPC returns no row (defensive)', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })

    const error = await supabasePaymentRepository.issueReceipt('payment-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('unknown')
  })

  it('maps FORBIDDEN to code forbidden', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'FORBIDDEN' } })

    const error = await supabasePaymentRepository.issueReceipt('payment-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('forbidden')
  })

  it('maps PAYMENT_NOT_CONFIRMED to code payment_not_confirmed', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'PAYMENT_NOT_CONFIRMED' } })

    const error = await supabasePaymentRepository.issueReceipt('payment-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('payment_not_confirmed')
  })

  it('maps PAYMENT_HAS_NO_ALLOCATIONS to code payment_has_no_allocations', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'PAYMENT_HAS_NO_ALLOCATIONS' } })

    const error = await supabasePaymentRepository.issueReceipt('payment-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('payment_has_no_allocations')
  })

  it('maps a raw Postgres unique_violation (23505) on receipts own UNIQUE(payment_id) to code receipt_already_issued', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'duplicate key value violates unique constraint "receipts_payment_id_key"', code: '23505' },
    })

    const error = await supabasePaymentRepository.issueReceipt('payment-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('receipt_already_issued')
  })

  it('maps any other unmapped exception string to code unknown', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'SOMETHING_ELSE' } })

    const error = await supabasePaymentRepository.issueReceipt('payment-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('unknown')
  })
})

describe('supabasePaymentRepository.listReportedByAdministration', () => {
  it('issues a single SELECT against payments, scoped by administration_id + status REPORTED, ordered newest-report-first', async () => {
    order.mockResolvedValueOnce({ data: [PAYMENT_ROW_REPORTED], error: null })

    await supabasePaymentRepository.listReportedByAdministration('admin-1')

    expect(from).toHaveBeenCalledWith('payments')
    expect(eq).toHaveBeenCalledWith('administration_id', 'admin-1')
    expect(eq).toHaveBeenCalledWith('status', 'REPORTED')
    expect(order).toHaveBeenCalledWith('reported_at', { ascending: false })
  })

  it('maps a payments row into camelCase domain shape', async () => {
    order.mockResolvedValueOnce({ data: [PAYMENT_ROW_REPORTED], error: null })

    const result = await supabasePaymentRepository.listReportedByAdministration('admin-1')

    expect(result).toEqual([PAYMENT_DOMAIN_REPORTED])
  })

  it('wraps a Supabase failure in PaymentRepositoryError with code unknown', async () => {
    order.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    const error = await supabasePaymentRepository.listReportedByAdministration('admin-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PaymentRepositoryError)
    expect((error as PaymentRepositoryError).code).toBe('unknown')
  })
})
