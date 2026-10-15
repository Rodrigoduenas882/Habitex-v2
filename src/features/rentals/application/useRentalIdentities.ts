import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { rentalParticipantRepository, rentalTermsRepository } from '../composition'
import type { RentalSubject } from '../domain/rental-subject.types'
import { rentalQueryKeys } from './rental-query-keys'
import { useRentals } from './useRentals'
import { useRentalSubjectLinks } from './useRentalSubjectLinks'
import { useRentalSubjects } from './useRentalSubjects'

export interface RentalIdentity {
  /**
   * The PRIMARY rental_relationship_subjects' resolved RentalSubject.label
   * (already a real property/room/parking name, never a UUID - see
   * RentalSubject's own doc comment). null only if the relationship
   * genuinely has no PRIMARY subject link resolved yet (should not happen
   * under FK integrity, but never fabricated).
   */
  subjectLabel: string | null
  /**
   * The current ACTIVE TENANT participant's full name. null if none
   * resolved (see RentalParticipantRepository's own doc comment).
   */
  tenantName: string | null
  /**
   * The current rental_term_versions.rent_amount. null for a DRAFT rental
   * that has no term version yet - a legitimate, honest state, never a
   * fabricated 0.
   */
  rentAmount: number | null
}

export interface RentalIdentities {
  status: 'loading' | 'error' | 'ready'
  byRelationshipId: Map<string, RentalIdentity>
}

const EMPTY_MAP = new Map<string, RentalIdentity>()

/**
 * Lists `active-tenant-names`, scoped by administrationId only - see
 * rentalQueryKeys.activeTenantNames's own doc comment. Enabled only once the
 * rentals list itself has resolved: `rentalRelationshipIds` is derived from
 * that already-fetched list, so firing this query before it settles would
 * either run with a stale/empty id set that never gets revisited (the query
 * key doesn't carry the ids, so a later id-set change wouldn't by itself
 * trigger a refetch) or need extra invalidation wiring this feature doesn't
 * have. An administration with zero rentals still reaches 'ready' here:
 * rentalRelationshipIds is then genuinely [], and the repository's own
 * empty-array guard resolves it immediately with zero network calls.
 */
function useActiveTenantNames(administrationId: string | undefined, rentalRelationshipIds: string[], ready: boolean) {
  return useQuery({
    queryKey: rentalQueryKeys.activeTenantNames(administrationId ?? 'pending'),
    queryFn: () => rentalParticipantRepository.listActiveTenantNamesByRelationshipIds(rentalRelationshipIds),
    enabled: administrationId != null && ready,
  })
}

/** Same reasoning and enabled condition as useActiveTenantNames above. */
function useCurrentRentAmounts(administrationId: string | undefined, rentalRelationshipIds: string[], ready: boolean) {
  return useQuery({
    queryKey: rentalQueryKeys.currentRentAmounts(administrationId ?? 'pending'),
    queryFn: () => rentalTermsRepository.listCurrentRentAmountsByRelationshipIds(rentalRelationshipIds),
    enabled: administrationId != null && ready,
  })
}

/**
 * Resolves the display identity (subject label, tenant name, rent amount) of
 * every rental relationship in `administrationId`, in one derived Map - the
 * read RentalListCard/RentalContextHeader need to show "what/who/how much"
 * without each re-implementing this cross-referencing (DS-002). Mirrors
 * useDashboardOccupancy's exact shape: composes several already-existing
 * administration-wide reads (useRentals, useRentalSubjectLinks, the 3
 * useRentalSubjects subject-type lists) plus 2 new batched reads
 * (active tenant names, current rent amounts), and derives the result
 * client-side via useMemo - never a partial/fabricated value while any
 * constituent query is still pending or has failed.
 *
 * Only `subjectRole === 'PRIMARY'` links are used to resolve a relationship's
 * subject label - an `INCLUDED` link (e.g. a parking sublease authorization)
 * must never be mistaken for a rental's primary identity (see
 * RentalRelationshipSubjectLink's own doc comment).
 */
export function useRentalIdentities(administrationId: string | undefined): RentalIdentities {
  const rentalsQuery = useRentals(administrationId)
  const subjectLinksQuery = useRentalSubjectLinks(administrationId)
  const fullPropertySubjectsQuery = useRentalSubjects(administrationId, 'FULL_PROPERTY')
  const roomSubjectsQuery = useRentalSubjects(administrationId, 'ROOM')
  const parkingSubjectsQuery = useRentalSubjects(administrationId, 'PARKING')

  const rentalRelationshipIds = useMemo(
    () => rentalsQuery.data?.map((rental) => rental.id) ?? [],
    [rentalsQuery.data],
  )

  const tenantNamesQuery = useActiveTenantNames(administrationId, rentalRelationshipIds, rentalsQuery.isSuccess)
  const rentAmountsQuery = useCurrentRentAmounts(administrationId, rentalRelationshipIds, rentalsQuery.isSuccess)

  const isError =
    rentalsQuery.isError ||
    subjectLinksQuery.isError ||
    fullPropertySubjectsQuery.isError ||
    roomSubjectsQuery.isError ||
    parkingSubjectsQuery.isError ||
    tenantNamesQuery.isError ||
    rentAmountsQuery.isError

  const isSuccess =
    rentalsQuery.isSuccess &&
    subjectLinksQuery.isSuccess &&
    fullPropertySubjectsQuery.isSuccess &&
    roomSubjectsQuery.isSuccess &&
    parkingSubjectsQuery.isSuccess &&
    tenantNamesQuery.isSuccess &&
    rentAmountsQuery.isSuccess

  const rentals = rentalsQuery.data
  const subjectLinks = subjectLinksQuery.data
  const fullPropertySubjects = fullPropertySubjectsQuery.data
  const roomSubjects = roomSubjectsQuery.data
  const parkingSubjects = parkingSubjectsQuery.data
  const tenantNames = tenantNamesQuery.data
  const rentAmounts = rentAmountsQuery.data

  return useMemo(() => {
    if (isError) {
      return { status: 'error', byRelationshipId: EMPTY_MAP }
    }

    if (
      !isSuccess ||
      !rentals ||
      !subjectLinks ||
      !fullPropertySubjects ||
      !roomSubjects ||
      !parkingSubjects ||
      !tenantNames ||
      !rentAmounts
    ) {
      return { status: 'loading', byRelationshipId: EMPTY_MAP }
    }

    const labelBySubjectId = new Map<string, string>(
      [...fullPropertySubjects, ...roomSubjects, ...parkingSubjects].map((subject: RentalSubject) => [
        subject.id,
        subject.label,
      ]),
    )

    const primarySubjectIdByRelationshipId = new Map<string, string>()
    for (const link of subjectLinks) {
      if (link.subjectRole === 'PRIMARY') {
        primarySubjectIdByRelationshipId.set(link.rentalRelationshipId, link.rentalSubjectId)
      }
    }

    const byRelationshipId = new Map<string, RentalIdentity>()
    for (const rental of rentals) {
      const primarySubjectId = primarySubjectIdByRelationshipId.get(rental.id)
      const subjectLabel = primarySubjectId != null ? (labelBySubjectId.get(primarySubjectId) ?? null) : null

      byRelationshipId.set(rental.id, {
        subjectLabel,
        tenantName: tenantNames.get(rental.id) ?? null,
        rentAmount: rentAmounts.get(rental.id) ?? null,
      })
    }

    return { status: 'ready', byRelationshipId }
  }, [isError, isSuccess, rentals, subjectLinks, fullPropertySubjects, roomSubjects, parkingSubjects, tenantNames, rentAmounts])
}
