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
 * The tenant side of createDraft's input - exactly the two mutually
 * exclusive cases create_rental_draft itself supports. `kind` is decided by
 * the caller (which tab of "¿A quién se lo arriendas?" was used), never
 * inferred from which fields happen to be filled.
 */
export type RentalDraftTenantInput =
  | { kind: 'existing'; personId: string }
  | {
      kind: 'new'
      fullName: string
      documentType: string | null
      documentNumber: string | null
      documentCountry: string | null
      nationalityCountry: string | null
      email: string | null
      phone: string | null
    }

export interface CreateRentalDraftInput {
  administrationId: string
  rentalSubjectId: string
  tenant: RentalDraftTenantInput
}

/**
 * Minimum required by create_rental_draft's own return shape, plus the
 * resolved tenant id (useful for the 'new' case, where the caller doesn't
 * know it up front).
 */
export interface CreateRentalDraftResult {
  rentalRelationshipId: string
  tenantPersonId: string
}

/**
 * listByAdministration only reads rental_relationships - not
 * rental_subjects, rental_relationship_subjects, rental_participants or
 * rental_term_versions. Those are separate tables with their own repos
 * (see RentalSubjectRepository/TenantCandidateRepository) or don't exist
 * yet in the frontend at all (rental_participants, rental_term_versions).
 *
 * createDraft calls create_rental_draft - the only way to create a
 * RentalRelationship. It creates, atomically server-side: the relationship
 * (DRAFT), its PRIMARY rental_relationship_subjects row, and LESSOR
 * (current_person_id(), resolved server-side - never sent from here) +
 * TENANT rental_participants rows. It never creates rental_term_versions or
 * occupancy - see activate_rental_relationship for what still gates
 * DRAFT -> ACTIVE. No activate/cancel/end/getById/update here - lifecycle
 * beyond DRAFT creation is out of scope for this increment.
 */
export interface RentalRepository {
  listByAdministration(administrationId: string): Promise<RentalRelationship[]>
  createDraft(input: CreateRentalDraftInput): Promise<CreateRentalDraftResult>
}
