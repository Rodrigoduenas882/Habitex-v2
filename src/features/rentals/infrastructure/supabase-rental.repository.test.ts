import { describe, expect, it, vi } from 'vitest'
import { RentalRepositoryError } from '../domain/rental.types'

const { eq, order, select, from } = vi.hoisted(() => {
  const order = vi.fn()
  const eq = vi.fn((_column: string, _value: string) => ({ order }))
  const select = vi.fn((_columns: string) => ({ eq }))
  const from = vi.fn((_table: string) => ({ select }))
  return { eq, order, select, from }
})

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: { from },
}))

import { supabaseRentalRepository } from './supabase-rental.repository'

const ALL_STATUSES = ['DRAFT', 'ACTIVE', 'ENDING', 'ENDED', 'CANCELLED'] as const

describe('supabaseRentalRepository.listByAdministration', () => {
  it('queries rental_relationships scoped by administration_id and maps snake_case rows to the domain shape', async () => {
    order.mockResolvedValueOnce({
      data: [
        {
          id: 'rental-1',
          administration_id: 'admin-1',
          status: 'ACTIVE',
          jurisdiction_country: 'CO',
          real_start_date: '2026-01-01',
          tracking_start_date: '2026-09-18',
          expected_end_date: '2027-01-01',
          actual_end_date: null,
          payment_day: 5,
          payment_timing: 'ADVANCE',
        },
      ],
      error: null,
    })

    const result = await supabaseRentalRepository.listByAdministration('admin-1')

    expect(from).toHaveBeenCalledWith('rental_relationships')
    expect(eq).toHaveBeenCalledWith('administration_id', 'admin-1')
    expect(result).toEqual([
      {
        id: 'rental-1',
        administrationId: 'admin-1',
        status: 'ACTIVE',
        jurisdictionCountry: 'CO',
        realStartDate: '2026-01-01',
        trackingStartDate: '2026-09-18',
        expectedEndDate: '2027-01-01',
        actualEndDate: null,
        paymentDay: 5,
        paymentTiming: 'ADVANCE',
      },
    ])
  })

  it('never selects every column with *, and never selects rental_subjects/participants/terms columns', () => {
    for (const [columns] of select.mock.calls) {
      expect(columns).not.toBe('*')
      expect(columns).not.toContain('*')
      expect(columns).not.toContain('rental_subject')
      expect(columns).not.toContain('participant')
      expect(columns).not.toContain('term')
    }
  })

  it('never queries a different table (no accidental joins to rental_subjects/participants/terms)', () => {
    for (const [table] of from.mock.calls) {
      expect(table).toBe('rental_relationships')
    }
  })

  it('preserves all nullable date/payment fields exactly as null, without inventing values', async () => {
    order.mockResolvedValueOnce({
      data: [
        {
          id: 'rental-2',
          administration_id: 'admin-1',
          status: 'DRAFT',
          jurisdiction_country: 'CO',
          real_start_date: null,
          tracking_start_date: null,
          expected_end_date: null,
          actual_end_date: null,
          payment_day: null,
          payment_timing: null,
        },
      ],
      error: null,
    })

    const result = await supabaseRentalRepository.listByAdministration('admin-1')

    expect(result).toEqual([
      {
        id: 'rental-2',
        administrationId: 'admin-1',
        status: 'DRAFT',
        jurisdictionCountry: 'CO',
        realStartDate: null,
        trackingStartDate: null,
        expectedEndDate: null,
        actualEndDate: null,
        paymentDay: null,
        paymentTiming: null,
      },
    ])
  })

  it('maps rows through unchanged for every real RentalStatus value', async () => {
    for (const status of ALL_STATUSES) {
      order.mockResolvedValueOnce({
        data: [
          {
            id: 'rental-3',
            administration_id: 'admin-1',
            status,
            jurisdiction_country: 'CO',
            real_start_date: null,
            tracking_start_date: null,
            expected_end_date: null,
            actual_end_date: null,
            payment_day: null,
            payment_timing: null,
          },
        ],
        error: null,
      })

      const result = await supabaseRentalRepository.listByAdministration('admin-1')

      expect(result[0]?.status).toBe(status)
    }
  })

  it('wraps a Supabase failure in RentalRepositoryError instead of throwing the raw error', async () => {
    order.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(supabaseRentalRepository.listByAdministration('admin-1')).rejects.toBeInstanceOf(
      RentalRepositoryError,
    )
  })
})
