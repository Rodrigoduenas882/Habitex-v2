import { describe, expect, it, vi } from 'vitest'
import { ChargeRepositoryError } from '../domain/charge.types'

const { chargesOrder, chargesEq, balancesEq, from, rpc } = vi.hoisted(() => {
  const chargesOrder = vi.fn()
  const chargesEq = vi.fn((_column: string, _value: string) => ({ order: chargesOrder }))
  const chargesSelect = vi.fn((_columns: string) => ({ eq: chargesEq }))

  const balancesEq = vi.fn()
  const balancesSelect = vi.fn((_columns: string) => ({ eq: balancesEq }))

  const from = vi.fn((table: string) => {
    if (table === 'charges') return { select: chargesSelect }
    if (table === 'charge_balances') return { select: balancesSelect }
    throw new Error(`supabase-charge.repository.test: unexpected table "${table}"`)
  })
  const rpc = vi.fn()

  return { chargesOrder, chargesEq, balancesEq, from, rpc }
})

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: { from, rpc },
}))

import { supabaseChargeRepository } from './supabase-charge.repository'

const CHARGE_ROW_RENT = {
  id: 'charge-1',
  administration_id: 'admin-1',
  rental_relationship_id: 'rel-1',
  charge_type: 'RENT' as const,
  origin: 'SYSTEM' as const,
  description: 'Renta de enero',
  period_start: '2026-01-01',
  period_end: '2026-01-31',
  due_date: '2026-01-05',
  amount: 1_000_000,
  currency: 'COP' as const,
  source_type: null,
  source_id: null,
  created_at: '2026-01-01T00:00:00Z',
}

const CHARGE_ROW_UTILITY = {
  id: 'charge-2',
  administration_id: 'admin-1',
  rental_relationship_id: 'rel-1',
  charge_type: 'UTILITY' as const,
  origin: 'MANUAL' as const,
  description: 'Servicio de agua',
  period_start: null,
  period_end: null,
  due_date: '2026-02-05',
  amount: 50_000,
  currency: 'COP' as const,
  source_type: null,
  source_id: null,
  created_at: '2026-02-01T00:00:00Z',
}

const BALANCE_ROW_PARTIAL = {
  charge_id: 'charge-1',
  administration_id: 'admin-1',
  rental_relationship_id: 'rel-1',
  amount: 1_000_000,
  paid_amount: 400_000,
  balance: 600_000,
  financial_status: 'PARTIAL' as const,
}

const BALANCE_ROW_PAID = {
  charge_id: 'charge-2',
  administration_id: 'admin-1',
  rental_relationship_id: 'rel-1',
  amount: 50_000,
  paid_amount: 50_000,
  balance: 0,
  financial_status: 'PAID' as const,
}

describe('supabaseChargeRepository.listByRelationship', () => {
  it('issues two separate SELECTs (charges, charge_balances), both scoped by rental_relationship_id', async () => {
    chargesOrder.mockResolvedValueOnce({ data: [CHARGE_ROW_RENT], error: null })
    balancesEq.mockResolvedValueOnce({ data: [BALANCE_ROW_PARTIAL], error: null })

    await supabaseChargeRepository.listByRelationship('rel-1')

    expect(from).toHaveBeenCalledWith('charges')
    expect(from).toHaveBeenCalledWith('charge_balances')
    expect(chargesEq).toHaveBeenCalledWith('rental_relationship_id', 'rel-1')
    expect(balancesEq).toHaveBeenCalledWith('rental_relationship_id', 'rel-1')
  })

  it('merges charges + charge_balances by id/charge_id, taking financial fields from the view - never computed locally', async () => {
    chargesOrder.mockResolvedValueOnce({ data: [CHARGE_ROW_RENT, CHARGE_ROW_UTILITY], error: null })
    balancesEq.mockResolvedValueOnce({ data: [BALANCE_ROW_PARTIAL, BALANCE_ROW_PAID], error: null })

    const result = await supabaseChargeRepository.listByRelationship('rel-1')

    expect(result).toEqual([
      {
        id: 'charge-1',
        administrationId: 'admin-1',
        rentalRelationshipId: 'rel-1',
        chargeType: 'RENT',
        origin: 'SYSTEM',
        description: 'Renta de enero',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        dueDate: '2026-01-05',
        amount: 1_000_000,
        currency: 'COP',
        sourceType: null,
        sourceId: null,
        createdAt: '2026-01-01T00:00:00Z',
        paidAmount: 400_000,
        balance: 600_000,
        financialStatus: 'PARTIAL',
      },
      {
        id: 'charge-2',
        administrationId: 'admin-1',
        rentalRelationshipId: 'rel-1',
        chargeType: 'UTILITY',
        origin: 'MANUAL',
        description: 'Servicio de agua',
        periodStart: null,
        periodEnd: null,
        dueDate: '2026-02-05',
        amount: 50_000,
        currency: 'COP',
        sourceType: null,
        sourceId: null,
        createdAt: '2026-02-01T00:00:00Z',
        paidAmount: 50_000,
        balance: 0,
        financialStatus: 'PAID',
      },
    ])
  })

  it('falls back to a defensive PENDING/zero-paid/full-balance shape when no matching charge_balances row exists (unreachable in practice)', async () => {
    chargesOrder.mockResolvedValueOnce({ data: [CHARGE_ROW_RENT], error: null })
    balancesEq.mockResolvedValueOnce({ data: [], error: null })

    const result = await supabaseChargeRepository.listByRelationship('rel-1')

    expect(result[0]).toMatchObject({ paidAmount: 0, balance: 1_000_000, financialStatus: 'PENDING' })
  })

  it('wraps a charges-query Supabase failure in ChargeRepositoryError with code unknown', async () => {
    chargesOrder.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    balancesEq.mockResolvedValueOnce({ data: [], error: null })

    const error = await supabaseChargeRepository.listByRelationship('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ChargeRepositoryError)
    expect((error as ChargeRepositoryError).code).toBe('unknown')
  })

  it('wraps a charge_balances-query Supabase failure in ChargeRepositoryError with code unknown', async () => {
    chargesOrder.mockResolvedValueOnce({ data: [CHARGE_ROW_RENT], error: null })
    balancesEq.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    const error = await supabaseChargeRepository.listByRelationship('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ChargeRepositoryError)
    expect((error as ChargeRepositoryError).code).toBe('unknown')
  })
})

describe('supabaseChargeRepository.generateRentCharges', () => {
  it('calls generate_rent_charges with only p_relationship_id - never p_through_date', async () => {
    rpc.mockResolvedValueOnce({ data: [CHARGE_ROW_RENT], error: null })

    await supabaseChargeRepository.generateRentCharges('rel-1')

    expect(rpc).toHaveBeenCalledWith('generate_rent_charges', { p_relationship_id: 'rel-1' })
    expect(rpc).toHaveBeenCalledTimes(1)
    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(Object.keys(args)).toEqual(['p_relationship_id'])
  })

  it('maps a non-empty RPC result to createdCount equal to its length', async () => {
    rpc.mockResolvedValueOnce({ data: [CHARGE_ROW_RENT, CHARGE_ROW_UTILITY], error: null })

    const result = await supabaseChargeRepository.generateRentCharges('rel-1')

    expect(result).toEqual({ createdCount: 2 })
  })

  it('maps a zero-length RPC result to createdCount 0 - a successful outcome, not an error', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null })

    const result = await supabaseChargeRepository.generateRentCharges('rel-1')

    expect(result).toEqual({ createdCount: 0 })
  })

  it('maps a null RPC data result to createdCount 0', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })

    const result = await supabaseChargeRepository.generateRentCharges('rel-1')

    expect(result).toEqual({ createdCount: 0 })
  })

  it('maps MANAGEMENT_ACCESS_REQUIRED to code management_access_required', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'MANAGEMENT_ACCESS_REQUIRED' } })

    const error = await supabaseChargeRepository.generateRentCharges('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ChargeRepositoryError)
    expect((error as ChargeRepositoryError).code).toBe('management_access_required')
  })

  it('maps RENTAL_NOT_CHARGEABLE to code not_chargeable', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'RENTAL_NOT_CHARGEABLE' } })

    const error = await supabaseChargeRepository.generateRentCharges('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ChargeRepositoryError)
    expect((error as ChargeRepositoryError).code).toBe('not_chargeable')
  })

  it('maps RENTAL_BILLING_CONFIGURATION_INCOMPLETE to code billing_configuration_incomplete', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'RENTAL_BILLING_CONFIGURATION_INCOMPLETE' } })

    const error = await supabaseChargeRepository.generateRentCharges('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ChargeRepositoryError)
    expect((error as ChargeRepositoryError).code).toBe('billing_configuration_incomplete')
  })

  it('maps RENTAL_RELATIONSHIP_NOT_FOUND (and any other unmapped exception) to code unknown', async () => {
    for (const message of ['RENTAL_RELATIONSHIP_NOT_FOUND', 'SOMETHING_ELSE']) {
      rpc.mockResolvedValueOnce({ data: null, error: { message } })

      const error = await supabaseChargeRepository.generateRentCharges('rel-1').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ChargeRepositoryError)
      expect((error as ChargeRepositoryError).code).toBe('unknown')
    }
  })

  it('never calls .from() - only the RPC is used to generate charges', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null })
    from.mockClear()

    await supabaseChargeRepository.generateRentCharges('rel-1')

    expect(from).not.toHaveBeenCalled()
  })
})
