import { useMemo } from 'react'
import { useAdministrationRooms } from '@/features/properties/application/useAdministrationRooms'
import { useRentalSubjectLinks } from '@/features/rentals/application/useRentalSubjectLinks'
import { useRentalSubjects } from '@/features/rentals/application/useRentalSubjects'
import { useRentals } from '@/features/rentals/application/useRentals'
import type { RentalSubject } from '@/features/rentals/domain/rental-subject.types'
import type { RentalStatus } from '@/features/rentals/domain/rental.types'

/**
 * Per-property occupancy signal PropertyCard needs - a FULL_PROPERTY
 * property's single unit occupied state, and a BY_ROOMS property's enabled/
 * occupied room counts. A property absent from `byPropertyId` (e.g. no
 * matching rental_subject yet, or zero enabled rooms) is simply not
 * occupied/has zero rooms - never an error.
 */
export interface PropertyOccupancyEntry {
  /** FULL_PROPERTY only - always false for a BY_ROOMS property. */
  isOccupied: boolean
  /** BY_ROOMS only - always 0/0 for a FULL_PROPERTY property. */
  occupiedRooms: number
  totalRooms: number
}

export interface PropertyOccupancyMap {
  status: 'loading' | 'error' | 'ready'
  byPropertyId: Map<string, PropertyOccupancyEntry>
}

const EMPTY_MAP = new Map<string, PropertyOccupancyEntry>()

function isLiveStatus(status: RentalStatus): boolean {
  return status === 'ACTIVE' || status === 'ENDING'
}

/**
 * Presentation-local, PropertiesOverview-scoped duplicate of a small slice of
 * useDashboardOccupancy's own cross-referencing logic (see that hook's own
 * doc comment for the full explanation of the data flow) - deliberately NOT
 * added to useDashboardOccupancy itself, which only returns an
 * administration-wide aggregate (occupiedUnits/totalUnits), not a
 * per-property breakdown. Extending that hook to also expose a per-property
 * map is a genuinely new capability outside this subtask's boundary (see the
 * PropertiesOverview wiring's own report) - this hook is the smaller,
 * presentation-local alternative: it re-fetches (React Query dedupes by
 * query key, so this is not a second network round trip) the same
 * rooms/rental_subjects/rental_relationship_subjects/rentals data and
 * derives only what PropertyCard's status badge/detail line need, scoped to
 * exactly this list.
 */
export function usePropertyOccupancy(administrationId: string | undefined): PropertyOccupancyMap {
  const roomsQuery = useAdministrationRooms(administrationId)
  const fullPropertySubjectsQuery = useRentalSubjects(administrationId, 'FULL_PROPERTY')
  const roomSubjectsQuery = useRentalSubjects(administrationId, 'ROOM')
  const subjectLinksQuery = useRentalSubjectLinks(administrationId)
  const rentalsQuery = useRentals(administrationId)

  const isError =
    roomsQuery.isError ||
    fullPropertySubjectsQuery.isError ||
    roomSubjectsQuery.isError ||
    subjectLinksQuery.isError ||
    rentalsQuery.isError

  const isSuccess =
    roomsQuery.isSuccess &&
    fullPropertySubjectsQuery.isSuccess &&
    roomSubjectsQuery.isSuccess &&
    subjectLinksQuery.isSuccess &&
    rentalsQuery.isSuccess

  const rooms = roomsQuery.data
  const fullPropertySubjects = fullPropertySubjectsQuery.data
  const roomSubjects = roomSubjectsQuery.data
  const subjectLinks = subjectLinksQuery.data
  const rentals = rentalsQuery.data

  return useMemo(() => {
    if (isError) {
      return { status: 'error', byPropertyId: EMPTY_MAP }
    }

    if (!isSuccess || !rooms || !fullPropertySubjects || !roomSubjects || !subjectLinks || !rentals) {
      return { status: 'loading', byPropertyId: EMPTY_MAP }
    }

    const statusByRelationshipId = new Map(rentals.map((rental) => [rental.id, rental.status]))

    const occupiedSubjectIds = new Set<string>()
    for (const link of subjectLinks) {
      const relationshipStatus = statusByRelationshipId.get(link.rentalRelationshipId)
      if (relationshipStatus != null && isLiveStatus(relationshipStatus)) {
        occupiedSubjectIds.add(link.rentalSubjectId)
      }
    }

    const subjectIdByPropertyId = new Map(
      fullPropertySubjects
        .filter((subject): subject is RentalSubject & { propertyId: string } => subject.propertyId != null)
        .map((subject) => [subject.propertyId, subject.id]),
    )
    const subjectIdByRoomId = new Map(
      roomSubjects
        .filter((subject): subject is RentalSubject & { roomId: string } => subject.roomId != null)
        .map((subject) => [subject.roomId, subject.id]),
    )

    const byPropertyId = new Map<string, PropertyOccupancyEntry>()

    for (const [propertyId, subjectId] of subjectIdByPropertyId) {
      byPropertyId.set(propertyId, {
        isOccupied: occupiedSubjectIds.has(subjectId),
        occupiedRooms: 0,
        totalRooms: 0,
      })
    }

    for (const room of rooms) {
      if (!room.isEnabled) continue

      const existing = byPropertyId.get(room.propertyId) ?? { isOccupied: false, occupiedRooms: 0, totalRooms: 0 }
      const subjectId = subjectIdByRoomId.get(room.id)
      const isRoomOccupied = subjectId != null && occupiedSubjectIds.has(subjectId)

      byPropertyId.set(room.propertyId, {
        isOccupied: existing.isOccupied,
        occupiedRooms: existing.occupiedRooms + (isRoomOccupied ? 1 : 0),
        totalRooms: existing.totalRooms + 1,
      })
    }

    return { status: 'ready', byPropertyId }
  }, [isError, isSuccess, rooms, fullPropertySubjects, roomSubjects, subjectLinks, rentals])
}
