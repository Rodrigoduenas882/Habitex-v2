import { describe, expect, it, vi } from 'vitest'
import { PropertyRepositoryError } from '../domain/property.types'

const { eq, select, from } = vi.hoisted(() => {
  const eq = vi.fn()
  const select = vi.fn((_columns: string) => ({ eq }))
  const from = vi.fn((_table: string) => ({ select }))
  return { eq, select, from }
})

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: { from },
}))

import { supabasePropertyRepository } from './supabase-property.repository'

describe('supabasePropertyRepository.listByAdministration', () => {
  it('queries properties scoped by administration_id and maps snake_case rows to the domain shape', async () => {
    eq.mockResolvedValueOnce({
      data: [
        {
          id: 'prop-1',
          administration_id: 'admin-1',
          property_type: 'APARTMENT',
          rental_mode: 'FULL_PROPERTY',
          name: 'Apartamento 302',
          country_code: 'CO',
          city: 'Bogotá',
          address: 'Calle 1 # 2-3',
          has_administration: true,
          administration_fee: 150000,
        },
      ],
      error: null,
    })

    const result = await supabasePropertyRepository.listByAdministration('admin-1')

    expect(from).toHaveBeenCalledWith('properties')
    expect(eq).toHaveBeenCalledWith('administration_id', 'admin-1')
    expect(result).toEqual([
      {
        id: 'prop-1',
        administrationId: 'admin-1',
        propertyType: 'APARTMENT',
        rentalMode: 'FULL_PROPERTY',
        name: 'Apartamento 302',
        countryCode: 'CO',
        city: 'Bogotá',
        address: 'Calle 1 # 2-3',
        hasAdministration: true,
        administrationFee: 150000,
      },
    ])
  })

  it('never selects every column with *', () => {
    for (const [columns] of select.mock.calls) {
      expect(columns).not.toBe('*')
      expect(columns).not.toContain('*')
    }
  })

  it('wraps a Supabase failure in PropertyRepositoryError instead of throwing the raw error', async () => {
    eq.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(
      supabasePropertyRepository.listByAdministration('admin-1'),
    ).rejects.toBeInstanceOf(PropertyRepositoryError)
  })
})
