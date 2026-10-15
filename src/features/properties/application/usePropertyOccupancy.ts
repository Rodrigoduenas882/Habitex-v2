import { useMemo } from 'react'
import { useRentalSubjectLinks } from '@/features/rentals/application/useRentalSubjectLinks'
import { useRentalSubjects } from '@/features/rentals/application/useRentalSubjects'
import { useRentals } from '@/features/rentals/application/useRentals'
import type { RentalSubject } from '@/features/rentals/domain/rental-subject.types'
import type { RentalStatus } from '@/features/rentals/domain/rental.types'
import type { Property } from '../domain/property.types'
import { useAdministrationRooms } from './useAdministrationRooms'

/**
 * Per-property occupancy signal - a FULL_PROPERTY property's single unit
 * occupied state, and a BY_ROOMS property's enabled/occupied room counts. A
 * property absent from `byPropertyId` (e.g. no matching rental_subject yet,
 * or zero enabled rooms) is simply not occupied/has zero rooms - never an
 * error.
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
 * Shared per-property occupancy cross-reference - the single source both
 * the Dashboard's PropertyCard and /properties's own PropertyListCard read
 * from, so "is this Property occupied" is never computed twice. Originally
 * Dashboard-presentation-local; moved here because Properties is the
 * natural owner of "occupancy of a Property/Room" even though it
 * cross-references rentals-feature data to compute it (same cross-feature
 * direction Dashboard itself already uses). React Query dedupes by query
 * key, so a Dashboard + Properties page both calling this for the same
 * administrationId is not a second network round trip.
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

/** 'unknown' covers the occupancy cross-reference still loading/erroring -
 * rendered as a distinct, honest neutral state rather than guessing
 * 'available'. The single definition of "is this Property occupied" -
 * every card that shows an occupancy badge (Dashboard's PropertyCard,
 * /properties's PropertyListCard) reads this same computation, never its
 * own re-derivation. */
export type PropertyOccupancyStatus = 'rented' | 'available' | 'unknown'

export interface PropertyOccupancyStatusResult {
  status: PropertyOccupancyStatus
  /** BY_ROOMS only - 0 for a FULL_PROPERTY property. */
  occupiedRooms: number
  /** BY_ROOMS only - 0 for a FULL_PROPERTY property. */
  totalRooms: number
}

/**
 * Pure, i18n-free status/raw-numbers computation shared by every caller
 * that needs to know whether a Property is occupied. Callers own their own
 * i18n-formatted `detail` string locally (see PropertiesOverview's
 * derivePropertyDisplay and PropertiesPage's equivalent) - this function
 * only ever returns the one true status, never re-derived differently by
 * two callers.
 */
export function derivePropertyOccupancyStatus(
  property: Property,
  occupancy: PropertyOccupancyMap,
): PropertyOccupancyStatusResult {
  if (property.rentalMode === 'FULL_PROPERTY') {
    if (occupancy.status !== 'ready') {
      return { status: 'unknown', occupiedRooms: 0, totalRooms: 0 }
    }
    const entry = occupancy.byPropertyId.get(property.id)
    return { status: entry?.isOccupied ? 'rented' : 'available', occupiedRooms: 0, totalRooms: 0 }
  }

  if (occupancy.status !== 'ready') {
    return { status: 'unknown', occupiedRooms: 0, totalRooms: 0 }
  }

  const entry = occupancy.byPropertyId.get(property.id) ?? {
    isOccupied: false,
    occupiedRooms: 0,
    totalRooms: 0,
  }
  return {
    status: entry.occupiedRooms > 0 ? 'rented' : 'available',
    occupiedRooms: entry.occupiedRooms,
    totalRooms: entry.totalRooms,
  }
}
