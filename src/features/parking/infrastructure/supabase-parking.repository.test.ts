import { describe, expect, it, vi } from 'vitest'
import { ParkingRepositoryError } from '../domain/parking.types'

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

import { supabaseParkingRepository } from './supabase-parking.repository'

const BASE_INPUT = {
  administrationId: 'admin-1',
  propertyId: null,
  identifier: 'Parqueadero 12',
  location: 'Sótano 1',
  covered: true,
  allowedVehicleType: 'CAR' as const,
  accessType: 'Control remoto',
  observations: 'Cerca al ascensor',
}

describe('supabaseParkingRepository.create', () => {
  it('calls create_parking_asset with the exact expected payload for an independent parking', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'rental-subject-1' }, error: null })

    await supabaseParkingRepository.create(BASE_INPUT)

    expect(rpc).toHaveBeenCalledWith('create_parking_asset', {
      p_administration_id: 'admin-1',
      p_identifier: 'Parqueadero 12',
      p_property_id: null,
      p_location: 'Sótano 1',
      p_covered: true,
      p_allowed_vehicle_type: 'CAR',
      p_access_type: 'Control remoto',
      p_observations: 'Cerca al ascensor',
    })
  })

  it('sends the real property id for an associated parking', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'rental-subject-2' }, error: null })

    await supabaseParkingRepository.create({ ...BASE_INPUT, propertyId: 'prop-1' })

    expect(rpc).toHaveBeenCalledWith(
      'create_parking_asset',
      expect.objectContaining({ p_property_id: 'prop-1' }),
    )
  })

  it('keeps covered as null when unspecified, instead of coercing to false', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'rental-subject-3' }, error: null })

    await supabaseParkingRepository.create({ ...BASE_INPUT, covered: null })

    expect(rpc).toHaveBeenCalledWith('create_parking_asset', expect.objectContaining({ p_covered: null }))
  })

  it('keeps allowed_vehicle_type as null when unspecified', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'rental-subject-4' }, error: null })

    await supabaseParkingRepository.create({ ...BASE_INPUT, allowedVehicleType: null })

    expect(rpc).toHaveBeenCalledWith(
      'create_parking_asset',
      expect.objectContaining({ p_allowed_vehicle_type: null }),
    )
  })

  it('does not treat the rental_subjects row as a Parking (returns void)', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'rental-subject-1' }, error: null })

    await expect(supabaseParkingRepository.create(BASE_INPUT)).resolves.toBeUndefined()
  })

  it('wraps a Supabase RPC failure in ParkingRepositoryError instead of throwing the raw error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(supabaseParkingRepository.create(BASE_INPUT)).rejects.toBeInstanceOf(
      ParkingRepositoryError,
    )
  })
})

describe('supabaseParkingRepository.listByAdministration', () => {
  it('queries parkings scoped by administration_id and maps snake_case rows to the domain shape', async () => {
    eq.mockResolvedValueOnce({
      data: [
        {
          id: 'parking-1',
          administration_id: 'admin-1',
          property_id: 'prop-1',
          identifier: 'Parqueadero 12',
          location: 'Sótano 1',
          covered: true,
          allowed_vehicle_type: 'CAR',
        },
      ],
      error: null,
    })

    const result = await supabaseParkingRepository.listByAdministration('admin-1')

    expect(from).toHaveBeenCalledWith('parkings')
    expect(eq).toHaveBeenCalledWith('administration_id', 'admin-1')
    expect(result).toEqual([
      {
        id: 'parking-1',
        administrationId: 'admin-1',
        propertyId: 'prop-1',
        identifier: 'Parqueadero 12',
        location: 'Sótano 1',
        covered: true,
        allowedVehicleType: 'CAR',
      },
    ])
  })

  it('never selects every column with *, and never selects accessType/observations/timestamps', () => {
    for (const [columns] of select.mock.calls) {
      expect(columns).not.toBe('*')
      expect(columns).not.toContain('*')
      expect(columns).not.toContain('access_type')
      expect(columns).not.toContain('observations')
      expect(columns).not.toContain('created_at')
      expect(columns).not.toContain('updated_at')
    }
  })

  it('preserves null propertyId, covered and allowedVehicleType exactly, without coercing them', async () => {
    eq.mockResolvedValueOnce({
      data: [
        {
          id: 'parking-2',
          administration_id: 'admin-1',
          property_id: null,
          identifier: 'Parqueadero 5',
          location: null,
          covered: null,
          allowed_vehicle_type: null,
        },
      ],
      error: null,
    })

    const result = await supabaseParkingRepository.listByAdministration('admin-1')

    expect(result).toEqual([
      {
        id: 'parking-2',
        administrationId: 'admin-1',
        propertyId: null,
        identifier: 'Parqueadero 5',
        location: null,
        covered: null,
        allowedVehicleType: null,
      },
    ])
  })

  it('wraps a Supabase failure in ParkingRepositoryError instead of throwing the raw error', async () => {
    eq.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(supabaseParkingRepository.listByAdministration('admin-1')).rejects.toBeInstanceOf(
      ParkingRepositoryError,
    )
  })
})
