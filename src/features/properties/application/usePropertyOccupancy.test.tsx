import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import type { Property } from '../domain/property.types'
import {
  derivePropertyOccupancyStatus,
  usePropertyOccupancy,
  type PropertyOccupancyMap,
} from './usePropertyOccupancy'

const { listRooms } = vi.hoisted(() => ({ listRooms: vi.fn() }))
const { listRentalSubjects, listSubjectLinks } = vi.hoisted(() => ({
  listRentalSubjects: vi.fn(),
  listSubjectLinks: vi.fn(),
}))
const { listRentals } = vi.hoisted(() => ({ listRentals: vi.fn() }))

vi.mock('../infrastructure/supabase-room.repository', () => ({
  supabaseRoomRepository: { listByAdministration: listRooms },
}))

vi.mock('@/features/rentals/infrastructure/supabase-rental-subject.repository', () => ({
  supabaseRentalSubjectRepository: {
    listByAdministration: listRentalSubjects,
    listRelationshipLinksByAdministration: listSubjectLinks,
  },
}))

vi.mock('@/features/rentals/infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: { listByAdministration: listRentals },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-1',
    administrationId: 'admin-1',
    propertyType: 'APARTMENT',
    rentalMode: 'FULL_PROPERTY',
    name: 'Apartamento 302',
    countryCode: 'CO',
    city: 'Bogotá',
    address: 'Calle 1 # 2-3',
    hasAdministration: false,
    administrationFee: null,
    ...overrides,
  }
}

describe('usePropertyOccupancy', () => {
  it('reports "ready" with an occupied FULL_PROPERTY entry when its rental_subject is linked to a live rental', async () => {
    listRooms.mockResolvedValueOnce([])
    listRentalSubjects.mockImplementation((_administrationId: string, subjectType: 'FULL_PROPERTY' | 'ROOM') =>
      Promise.resolve(
        subjectType === 'FULL_PROPERTY'
          ? [
              {
                id: 'subject-1',
                administrationId: 'admin-1',
                subjectType: 'FULL_PROPERTY',
                propertyId: 'prop-1',
                roomId: null,
                parkingId: null,
                label: 'Apartamento 302',
              },
            ]
          : [],
      ),
    )
    listSubjectLinks.mockResolvedValueOnce([
      { rentalRelationshipId: 'rel-1', rentalSubjectId: 'subject-1', subjectRole: 'PRIMARY' },
    ])
    listRentals.mockResolvedValueOnce([{ id: 'rel-1', status: 'ACTIVE' }])

    const { result } = renderHook(() => usePropertyOccupancy('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    expect(result.current.byPropertyId.get('prop-1')).toEqual({
      isOccupied: true,
      occupiedRooms: 0,
      totalRooms: 0,
    })
  })

  it('reports "error" when any of its cross-referenced reads fails', async () => {
    listRooms.mockRejectedValueOnce(new Error('boom'))
    listRentalSubjects.mockResolvedValue([])
    listSubjectLinks.mockResolvedValueOnce([])
    listRentals.mockResolvedValueOnce([])

    const { result } = renderHook(() => usePropertyOccupancy('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
    expect(result.current.byPropertyId.size).toBe(0)
  })
})

describe('derivePropertyOccupancyStatus', () => {
  const READY_EMPTY: PropertyOccupancyMap = { status: 'ready', byPropertyId: new Map() }

  it('returns "unknown" with zero room counts while occupancy is still loading/erroring, for both rental modes', () => {
    const loading: PropertyOccupancyMap = { status: 'loading', byPropertyId: new Map() }

    expect(derivePropertyOccupancyStatus(makeProperty({ rentalMode: 'FULL_PROPERTY' }), loading)).toEqual({
      status: 'unknown',
      occupiedRooms: 0,
      totalRooms: 0,
    })
    expect(derivePropertyOccupancyStatus(makeProperty({ rentalMode: 'BY_ROOMS' }), loading)).toEqual({
      status: 'unknown',
      occupiedRooms: 0,
      totalRooms: 0,
    })
  })

  it('returns "rented" for a FULL_PROPERTY whose occupancy entry is occupied', () => {
    const occupancy: PropertyOccupancyMap = {
      status: 'ready',
      byPropertyId: new Map([['prop-1', { isOccupied: true, occupiedRooms: 0, totalRooms: 0 }]]),
    }

    expect(derivePropertyOccupancyStatus(makeProperty(), occupancy)).toEqual({
      status: 'rented',
      occupiedRooms: 0,
      totalRooms: 0,
    })
  })

  it('returns "available" for a FULL_PROPERTY with no matching occupied entry', () => {
    expect(derivePropertyOccupancyStatus(makeProperty(), READY_EMPTY)).toEqual({
      status: 'available',
      occupiedRooms: 0,
      totalRooms: 0,
    })
  })

  it('returns "rented" with the real occupied/total room counts for a BY_ROOMS property with at least one occupied room', () => {
    const byRooms = makeProperty({ id: 'prop-3', rentalMode: 'BY_ROOMS' })
    const occupancy: PropertyOccupancyMap = {
      status: 'ready',
      byPropertyId: new Map([['prop-3', { isOccupied: false, occupiedRooms: 1, totalRooms: 3 }]]),
    }

    expect(derivePropertyOccupancyStatus(byRooms, occupancy)).toEqual({
      status: 'rented',
      occupiedRooms: 1,
      totalRooms: 3,
    })
  })

  it('returns "available" for a BY_ROOMS property with zero occupied rooms', () => {
    const byRooms = makeProperty({ id: 'prop-4', rentalMode: 'BY_ROOMS' })

    expect(derivePropertyOccupancyStatus(byRooms, READY_EMPTY)).toEqual({
      status: 'available',
      occupiedRooms: 0,
      totalRooms: 0,
    })
  })
})
