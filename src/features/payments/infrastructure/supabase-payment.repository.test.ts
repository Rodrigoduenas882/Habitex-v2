import { describe, expect, it, vi } from 'vitest'
import { PaymentRepositoryError } from '../domain/payment.types'

const { order, eq, from, rpc } = vi.hoisted(() => {
  const order = vi.fn()
  const eq = vi.fn((_column: string, _value: string) => ({ order }))
  const select = vi.fn((_columns: string) => ({ eq }))

  const from = vi.fn((table: string) => {
    if (table === 'payments') return { select }
    throw new Error(`supabase-payment.repository.test: unexpected table "${table}"`)
  })
  const rpc = vi.fn()

  return { order, eq, from, rpc }
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
