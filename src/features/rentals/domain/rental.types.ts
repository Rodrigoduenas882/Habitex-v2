/** rental_status, confirmed against the deployed schema. */
export type RentalStatus = 'DRAFT' | 'ACTIVE' | 'ENDING' | 'ENDED' | 'CANCELLED'

/** payment_timing, confirmed against the deployed schema. */
export type PaymentTiming = 'ADVANCE' | 'ARREARS'

/**
 * A rental relationship, read-only for this increment. Deliberately does
 * not carry tenantName/propertyName/subject/rentAmount/occupancy/balance -
 * this feature does not read rental_subjects, rental_participants or
 * rental_term_versions yet (see RentalRepository's own doc comment), so
 * none of that is honest to expose here. status comes directly from the
 * backend and is never derived from dates.
 */
export interface RentalRelationship {
  id: string
  administrationId: string
  status: RentalStatus
  jurisdictionCountry: string
  realStartDate: string | null
  trackingStartDate: string | null
  expectedEndDate: string | null
  actualEndDate: string | null
  paymentDay: number | null
  paymentTiming: PaymentTiming | null
}

/**
 * Wraps a failed Supabase call so nothing above infrastructure/ ever sees a
 * raw PostgrestError.
 */
export class RentalRepositoryError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'RentalRepositoryError'
    this.cause = cause
  }
}

/**
 * listByAdministration only reads rental_relationships - not
 * rental_subjects, rental_relationship_subjects, rental_participants or
 * rental_term_versions. Those are separate tables with their own repos in
 * a future increment; this one deliberately does not resolve the
 * arrendable object, tenant or economics yet.
 *
 * No create/activate/cancel/end/getById here - lifecycle and creation are
 * out of scope for this increment (no dedicated transactional RPC is
 * confirmed to exist yet for DRAFT creation).
 */
export interface RentalRepository {
  listByAdministration(administrationId: string): Promise<RentalRelationship[]>
}
