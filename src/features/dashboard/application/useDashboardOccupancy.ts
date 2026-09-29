import { useMemo } from 'react'
import { useAdministrationRooms } from '@/features/properties/application/useAdministrationRooms'
import { useProperties } from '@/features/properties/application/useProperties'
import { useRentalSubjectLinks } from '@/features/rentals/application/useRentalSubjectLinks'
import { useRentalSubjects } from '@/features/rentals/application/useRentalSubjects'
import { useRentals } from '@/features/rentals/application/useRentals'
import type { RentalSubject } from '@/features/rentals/domain/rental-subject.types'
import type { RentalStatus } from '@/features/rentals/domain/rental.types'

export interface DashboardOccupancy {
  status: 'loading' | 'error' | 'ready'
  occupiedUnits: number
  totalUnits: number
  /** null when totalUnits === 0 - there is no meaningful percentage to show. */
  percentage: number | null
}

const LOADING: DashboardOccupancy = { status: 'loading', occupiedUnits: 0, totalUnits: 0, percentage: null }
const ERROR: DashboardOccupancy = { status: 'error', occupiedUnits: 0, totalUnits: 0, percentage: null }

/** Statuses that count as "occupied" for a rental_subject - mirrors activeRelationshipCount's own set. */
function isLiveStatus(status: RentalStatus): boolean {
  return status === 'ACTIVE' || status === 'ENDING'
}

/**
 * Computes the administration's occupancy KPI, per the human-approved
 * definition (occupied rentable units / total rentable units):
 *
 * - A FULL_PROPERTY-mode Property contributes exactly 1 unit.
 * - A BY_ROOMS-mode property contributes its enabled Room count (1 unit per
 *   enabled room; disabled rooms don't count).
 * - Parking contributes 0 - excluded entirely from this MVP KPI.
 *
 * Data flow: useRentalSubjectLinks gives every rental_relationship_subjects
 * row (rentalSubjectId <-> rentalRelationshipId) for the administration;
 * useRentals gives every relationship's current status. Cross-referencing
 * those two builds `occupiedSubjectIds` - the set of rental_subject ids
 * currently tied to a live (ACTIVE/ENDING) relationship. Separately,
 * useRentalSubjects('FULL_PROPERTY')/useRentalSubjects('ROOM') give the
 * rental_subjects rows themselves, each carrying its own propertyId/roomId -
 * those are used to build propertyId->subjectId and roomId->subjectId
 * lookups. Then: for each FULL_PROPERTY property (from useProperties), and
 * each enabled Room of a BY_ROOMS property (from useAdministrationRooms,
 * cross-referenced against useProperties for rentalMode), the matching
 * subject id (via the lookups above) is checked against
 * `occupiedSubjectIds`. A unit with no matching rental_subjects row at all
 * is simply not occupied - never an error.
 */
export function useDashboardOccupancy(administrationId: string | undefined): DashboardOccupancy {
  const propertiesQuery = useProperties(administrationId)
  const roomsQuery = useAdministrationRooms(administrationId)
  const fullPropertySubjectsQuery = useRentalSubjects(administrationId, 'FULL_PROPERTY')
  const roomSubjectsQuery = useRentalSubjects(administrationId, 'ROOM')
  const subjectLinksQuery = useRentalSubjectLinks(administrationId)
  const rentalsQuery = useRentals(administrationId)

  const isError =
    propertiesQuery.isError ||
    roomsQuery.isError ||
    fullPropertySubjectsQuery.isError ||
    roomSubjectsQuery.isError ||
    subjectLinksQuery.isError ||
    rentalsQuery.isError

  const isSuccess =
    propertiesQuery.isSuccess &&
    roomsQuery.isSuccess &&
    fullPropertySubjectsQuery.isSuccess &&
    roomSubjectsQuery.isSuccess &&
    subjectLinksQuery.isSuccess &&
    rentalsQuery.isSuccess

  const properties = propertiesQuery.data
  const rooms = roomsQuery.data
  const fullPropertySubjects = fullPropertySubjectsQuery.data
  const roomSubjects = roomSubjectsQuery.data
  const subjectLinks = subjectLinksQuery.data
  const rentals = rentalsQuery.data

  return useMemo(() => {
    if (isError) {
      return ERROR
    }

    if (!isSuccess || !properties || !rooms || !fullPropertySubjects || !roomSubjects || !subjectLinks || !rentals) {
      return LOADING
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

    let totalUnits = 0
    let occupiedUnits = 0

    const byRoomsPropertyIds = new Set<string>()
    for (const property of properties) {
      if (property.rentalMode === 'FULL_PROPERTY') {
        totalUnits += 1
        const subjectId = subjectIdByPropertyId.get(property.id)
        if (subjectId != null && occupiedSubjectIds.has(subjectId)) {
          occupiedUnits += 1
        }
      } else {
        byRoomsPropertyIds.add(property.id)
      }
    }

    for (const room of rooms) {
      if (!room.isEnabled) continue
      if (!byRoomsPropertyIds.has(room.propertyId)) continue

      totalUnits += 1
      const subjectId = subjectIdByRoomId.get(room.id)
      if (subjectId != null && occupiedSubjectIds.has(subjectId)) {
        occupiedUnits += 1
      }
    }

    return {
      status: 'ready',
      occupiedUnits,
      totalUnits,
      percentage: totalUnits === 0 ? null : Math.round((occupiedUnits / totalUnits) * 100),
    }
  }, [isError, isSuccess, properties, rooms, fullPropertySubjects, roomSubjects, subjectLinks, rentals])
}
