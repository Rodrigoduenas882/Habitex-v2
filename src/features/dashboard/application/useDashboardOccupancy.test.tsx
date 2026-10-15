import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { useDashboardOccupancy } from './useDashboardOccupancy'

const {
  propertiesListByAdministration,
  roomsListByAdministration,
  subjectsListByAdministration,
  linksListByAdministration,
  rentalsListByAdministration,
} = vi.hoisted(() => ({
  propertiesListByAdministration: vi.fn(),
  roomsListByAdministration: vi.fn(),
  subjectsListByAdministration: vi.fn(),
  linksListByAdministration: vi.fn(),
  rentalsListByAdministration: vi.fn(),
}))

vi.mock('@/features/properties/infrastructure/supabase-property.repository', () => ({
  supabasePropertyRepository: { listByAdministration: propertiesListByAdministration },
}))
vi.mock('@/features/properties/infrastructure/supabase-room.repository', () => ({
  supabaseRoomRepository: { listByAdministration: roomsListByAdministration },
}))
vi.mock('@/features/rentals/infrastructure/supabase-rental-subject.repository', () => ({
  supabaseRentalSubjectRepository: {
    listByAdministration: subjectsListByAdministration,
    listRelationshipLinksByAdministration: linksListByAdministration,
  },
}))
vi.mock('@/features/rentals/infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: { listByAdministration: rentalsListByAdministration },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function property(id: string, rentalMode: 'FULL_PROPERTY' | 'BY_ROOMS') {
  return {
    id,
    administrationId: 'admin-1',
    propertyType: 'APARTMENT' as const,
    rentalMode,
    name: `Property ${id}`,
    countryCode: 'CO',
    city: 'Bogotá',
    address: 'Calle 1',
    hasAdministration: false,
    administrationFee: null,
  }
}

function room(id: string, propertyId: string, isEnabled: boolean) {
  return {
    id,
    administrationId: 'admin-1',
    propertyId,
    name: `Room ${id}`,
    bathroomType: null,
    furnished: false,
    description: null,
    isEnabled,
  }
}

function fullPropertySubject(id: string, propertyId: string) {
  return {
    id,
    administrationId: 'admin-1',
    subjectType: 'FULL_PROPERTY' as const,
    propertyId,
    roomId: null,
    parkingId: null,
    label: propertyId,
  }
}

function roomSubject(id: string, roomId: string) {
  return {
    id,
    administrationId: 'admin-1',
    subjectType: 'ROOM' as const,
    propertyId: null,
    roomId,
    parkingId: null,
    label: roomId,
  }
}

function rental(id: string, status: 'DRAFT' | 'ACTIVE' | 'ENDING' | 'ENDED' | 'CANCELLED') {
  return {
    id,
    administrationId: 'admin-1',
    status,
    jurisdictionCountry: 'CO',
    realStartDate: null,
    trackingStartDate: null,
    expectedEndDate: null,
    actualEndDate: null,
    paymentDay: null,
    paymentTiming: null,
  }
}

/**
 * Fixture: prop-full-1 (FULL_PROPERTY, ACTIVE relationship -> occupied),
 * prop-full-2 (FULL_PROPERTY, no rental_subjects row at all -> not occupied,
 * no crash), prop-rooms-1 (BY_ROOMS) with room-1 (enabled, ACTIVE
 * relationship -> occupied), room-2 (enabled, DRAFT relationship -> not
 * occupied), room-3 (enabled, no subject at all -> not occupied), room-4
 * (disabled -> excluded entirely from the denominator).
 */
function setUpRealisticFixture() {
  propertiesListByAdministration.mockResolvedValueOnce([
    property('prop-full-1', 'FULL_PROPERTY'),
    property('prop-full-2', 'FULL_PROPERTY'),
    property('prop-rooms-1', 'BY_ROOMS'),
  ])
  roomsListByAdministration.mockResolvedValueOnce([
    room('room-1', 'prop-rooms-1', true),
    room('room-2', 'prop-rooms-1', true),
    room('room-3', 'prop-rooms-1', true),
    room('room-4', 'prop-rooms-1', false),
  ])
  subjectsListByAdministration.mockImplementation((_administrationId: string, subjectType: string) => {
    if (subjectType === 'FULL_PROPERTY') {
      return Promise.resolve([fullPropertySubject('subj-full-1', 'prop-full-1')])
    }
    if (subjectType === 'ROOM') {
      return Promise.resolve([roomSubject('subj-room-1', 'room-1'), roomSubject('subj-room-2', 'room-2')])
    }
    return Promise.resolve([])
  })
  linksListByAdministration.mockResolvedValueOnce([
    { rentalRelationshipId: 'rel-full-1', rentalSubjectId: 'subj-full-1' },
    { rentalRelationshipId: 'rel-room-1', rentalSubjectId: 'subj-room-1' },
    { rentalRelationshipId: 'rel-room-2', rentalSubjectId: 'subj-room-2' },
  ])
  rentalsListByAdministration.mockResolvedValueOnce([
    rental('rel-full-1', 'ACTIVE'),
    rental('rel-room-1', 'ACTIVE'),
    rental('rel-room-2', 'DRAFT'),
  ])
}

describe('useDashboardOccupancy', () => {
  it('computes occupiedUnits/totalUnits/percentage exactly, per the human-approved occupancy definition', async () => {
    setUpRealisticFixture()

    const { result } = renderHook(() => useDashboardOccupancy('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    // totalUnits: 2 FULL_PROPERTY properties + 3 enabled rooms (room-4 excluded) = 5
    // occupiedUnits: prop-full-1 (ACTIVE) + room-1 (ACTIVE) = 2 (room-2's DRAFT relationship doesn't count, room-3 has no subject)
    expect(result.current.totalUnits).toBe(5)
    expect(result.current.occupiedUnits).toBe(2)
    expect(result.current.percentage).toBe(40)
  })

  it('returns percentage null when totalUnits is 0 (no FULL_PROPERTY properties and no enabled rooms anywhere)', async () => {
    propertiesListByAdministration.mockResolvedValueOnce([])
    roomsListByAdministration.mockResolvedValueOnce([])
    subjectsListByAdministration.mockResolvedValue([])
    linksListByAdministration.mockResolvedValueOnce([])
    rentalsListByAdministration.mockResolvedValueOnce([])

    const { result } = renderHook(() => useDashboardOccupancy('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(result.current.totalUnits).toBe(0)
    expect(result.current.occupiedUnits).toBe(0)
    expect(result.current.percentage).toBeNull()
  })

  it('reports status "loading" while any dependency query is still pending', () => {
    propertiesListByAdministration.mockReturnValueOnce(new Promise(() => {}))
    roomsListByAdministration.mockResolvedValueOnce([])
    subjectsListByAdministration.mockResolvedValue([])
    linksListByAdministration.mockResolvedValueOnce([])
    rentalsListByAdministration.mockResolvedValueOnce([])

    const { result } = renderHook(() => useDashboardOccupancy('admin-1'), { wrapper })

    expect(result.current.status).toBe('loading')
  })

  it('reports status "error" if any dependency query fails', async () => {
    propertiesListByAdministration.mockRejectedValueOnce(new Error('boom'))
    roomsListByAdministration.mockResolvedValueOnce([])
    subjectsListByAdministration.mockResolvedValue([])
    linksListByAdministration.mockResolvedValueOnce([])
    rentalsListByAdministration.mockResolvedValueOnce([])

    const { result } = renderHook(() => useDashboardOccupancy('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
  })
})
