import type { RentalTermVersion } from '@/features/rentals/domain/rental-terms.types'
import type { RentalRelationship } from '@/features/rentals/domain/rental.types'
import type { ContractTermsSnapshot } from './contract.types'

/**
 * Builds the exact ContractTermsSnapshot shape (see contract.types.ts's own
 * doc comment) from the two already-established sources of "the rental's
 * terms" - RentalRelationship's own schedule fields and the relationship's
 * current RentalTermVersion's financial fields. Pure, no I/O.
 *
 * relationship.realStartDate/trackingStartDate/paymentDay/paymentTiming are
 * typed nullable on RentalRelationship in general, but
 * activate_rental_relationship's own precondition guarantees all four are
 * set once a relationship has ever reached ACTIVE - the only statuses this
 * is ever called for are ACTIVE/ENDING (see RentalContractsPage's own doc
 * comment on when the creation section renders), so null here would mean a
 * genuinely broken invariant, not an expected case. Throws rather than
 * silently building a snapshot with fabricated/empty values.
 */
export function buildTermsSnapshot(
  relationship: RentalRelationship,
  termVersion: RentalTermVersion,
): ContractTermsSnapshot {
  if (
    relationship.realStartDate === null ||
    relationship.trackingStartDate === null ||
    relationship.paymentDay === null ||
    relationship.paymentTiming === null
  ) {
    throw new Error(
      'buildTermsSnapshot: the rental relationship is missing required schedule fields - expected ' +
        'these to always be set once a relationship has reached ACTIVE/ENDING',
    )
  }

  return {
    rentAmount: termVersion.rentAmount,
    administrationMode: termVersion.administrationMode,
    utilitiesMode: termVersion.utilitiesMode,
    effectiveFrom: termVersion.effectiveFrom,
    realStartDate: relationship.realStartDate,
    trackingStartDate: relationship.trackingStartDate,
    paymentDay: relationship.paymentDay,
    paymentTiming: relationship.paymentTiming,
    expectedEndDate: relationship.expectedEndDate,
  }
}
