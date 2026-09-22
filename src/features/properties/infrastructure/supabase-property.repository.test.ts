import { describe, expect, it, vi } from 'vitest'
import { PropertyRepositoryError } from '../domain/property.types'

const { eq, select, from, rpc } = vi.hoisted(() => {
  const eq = vi.fn()
  const select = vi.fn((_columns: string) => ({ eq }))
  const from = vi.fn((_table: string) => ({ select }))
  const rpc = vi.fn()
  return { eq, select, from, rpc }
})

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: { from, rpc },
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

const CREATE_INPUT = {
  administrationId: 'admin-1',
  propertyType: 'APARTMENT' as const,
  name: 'Apartamento 302',
  city: 'Bogotá',
  address: 'Calle 1 # 2-3',
  countryCode: 'CO',
  hasAdministration: true,
  administrationFee: 150000,
}

const EXPECTED_RPC_ARGS = {
  p_administration_id: 'admin-1',
  p_property_type: 'APARTMENT',
  p_name: 'Apartamento 302',
  p_city: 'Bogotá',
  p_address: 'Calle 1 # 2-3',
  p_country_code: 'CO',
  p_has_administration: true,
  p_administration_fee: 150000,
}

describe('supabasePropertyRepository.createFullProperty', () => {
  it('calls create_full_property_asset with the exact expected payload', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'rental-subject-1' }, error: null })

    await supabasePropertyRepository.createFullProperty(CREATE_INPUT)

    expect(rpc).toHaveBeenCalledWith('create_full_property_asset', EXPECTED_RPC_ARGS)
  })

  it('does not treat the rental_subjects row as a Property (returns void)', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'rental-subject-1' }, error: null })

    await expect(supabasePropertyRepository.createFullProperty(CREATE_INPUT)).resolves.toBeUndefined()
  })

  it('wraps a Supabase RPC failure in PropertyRepositoryError', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(supabasePropertyRepository.createFullProperty(CREATE_INPUT)).rejects.toBeInstanceOf(
      PropertyRepositoryError,
    )
  })
})

describe('supabasePropertyRepository.createRoomRentalProperty', () => {
  it('calls create_room_rental_property with the exact expected payload', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        id: 'prop-2',
        administration_id: 'admin-1',
        property_type: 'APARTMENT',
        rental_mode: 'BY_ROOMS',
        name: 'Apartamento 302',
        country_code: 'CO',
        city: 'Bogotá',
        address: 'Calle 1 # 2-3',
        has_administration: true,
        administration_fee: 150000,
      },
      error: null,
    })

    await supabasePropertyRepository.createRoomRentalProperty(CREATE_INPUT)

    expect(rpc).toHaveBeenCalledWith('create_room_rental_property', EXPECTED_RPC_ARGS)
  })

  it('maps the returned properties row to the domain Property shape', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        id: 'prop-2',
        administration_id: 'admin-1',
        property_type: 'APARTMENT',
        rental_mode: 'BY_ROOMS',
        name: 'Apartamento 302',
        country_code: 'CO',
        city: 'Bogotá',
        address: 'Calle 1 # 2-3',
        has_administration: true,
        administration_fee: 150000,
      },
      error: null,
    })

    const result = await supabasePropertyRepository.createRoomRentalProperty(CREATE_INPUT)

    expect(result).toEqual({
      id: 'prop-2',
      administrationId: 'admin-1',
      propertyType: 'APARTMENT',
      rentalMode: 'BY_ROOMS',
      name: 'Apartamento 302',
      countryCode: 'CO',
      city: 'Bogotá',
      address: 'Calle 1 # 2-3',
      hasAdministration: true,
      administrationFee: 150000,
    })
  })

  it('also maps correctly when PostgREST wraps the single row in an array', async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          id: 'prop-2',
          administration_id: 'admin-1',
          property_type: 'APARTMENT',
          rental_mode: 'BY_ROOMS',
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

    const result = await supabasePropertyRepository.createRoomRentalProperty(CREATE_INPUT)

    expect(result.id).toBe('prop-2')
  })

  it('wraps a Supabase RPC failure in PropertyRepositoryError', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(
      supabasePropertyRepository.createRoomRentalProperty(CREATE_INPUT),
    ).rejects.toBeInstanceOf(PropertyRepositoryError)
  })
})
