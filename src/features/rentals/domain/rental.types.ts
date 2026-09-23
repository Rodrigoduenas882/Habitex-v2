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
 * Mirrors the backend's active_relationship_count() SQL function exactly -
 * ACTIVE and ENDING are the only statuses that count toward an
 * administration's active_relationship_limit; DRAFT/ENDED/CANCELLED never
 * do. Pure and read-only: used for the client-side capacity gate
 * (management-access.ts's hasRelationshipCapacity), never as a replacement
 * for the RPC's own authoritative check.
 */
export function activeRelationshipCount(rentals: RentalRelationship[]): number {
  return rentals.filter((rental) => rental.status === 'ACTIVE' || rental.status === 'ENDING').length
}

/**
 * Known, user-facing activate_rental_relationship failure categories.
 * Deliberately coarse, mirroring SessionAuthError's shape: only the two
 * cases this increment (INC-004) needs to distinguish in the UI get their
 * own code. Every other exception the RPC can raise (RENTAL_NOT_FOUND,
 * RENTAL_NOT_DRAFT, RENTAL_TERMS_INCOMPLETE, PRIMARY_SUBJECT_REQUIRED,
 * ACTIVE_TENANT_REQUIRED, ACTIVE_LESSOR_REQUIRED,
 * INITIAL_TERM_VERSION_REQUIRED, RENTAL_SUBJECT_ALREADY_IN_USE,
 * PARKING_ALREADY_SUBLEASED) falls back to 'unknown' by design - per-code UX
 * for those is out of scope here and belongs to a later increment
 * (INC-006/INC-008).
 */
export type RentalActivationErrorCode = 'management_access_required' | 'capacity_reached' | 'unknown'

export class RentalActivationError extends Error {
  readonly code: RentalActivationErrorCode

  constructor(code: RentalActivationErrorCode, cause?: unknown) {
    super(`Rental activation error: ${code}`)
    this.name = 'RentalActivationError'
    this.code = code
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
 * DRAFT -> ACTIVE.
 *
 * activate calls activate_rental_relationship - the only way to transition
 * DRAFT -> ACTIVE. It is the real security/business-rule boundary (RLS +
 * this RPC, SECURITY DEFINER); any client-side gate (management-access.ts,
 * activeRelationshipCount) is UX convenience layered on top, never a
 * substitute for calling this. No cancel/end/getById/update here -
 * lifecycle beyond DRAFT creation and activation is out of scope for this
 * increment.
 */
export interface RentalRepository {
  listByAdministration(administrationId: string): Promise<RentalRelationship[]>
  createDraft(input: CreateRentalDraftInput): Promise<CreateRentalDraftResult>
  activate(relationshipId: string): Promise<RentalRelationship>
}
