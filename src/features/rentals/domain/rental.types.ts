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
 * Deliberately coarse, mirroring SessionAuthError's shape - only exceptions
 * this frontend can actually reach through its own flows get their own
 * code (see toRentalActivationError's own doc comment for the full
 * RPC-string -> code mapping):
 *
 * - 'management_access_required' <- MANAGEMENT_ACCESS_REQUIRED (INC-004)
 * - 'capacity_reached' <- RELATIONSHIP_CAPACITY_REACHED (INC-004)
 * - 'terms_incomplete' <- RENTAL_TERMS_INCOMPLETE and
 *   INITIAL_TERM_VERSION_REQUIRED (INC-008) - both mean the same thing from
 *   the user's perspective ("finish this rental's terms first"), so they
 *   share one code even though the RPC raises two distinct strings.
 * - 'already_active' <- RENTAL_NOT_DRAFT (INC-008) - reachable via stale
 *   client state (two tabs, two people managing the same administration)
 *   where the rental was activated elsewhere while this view still shows
 *   DRAFT.
 * - 'subject_in_use' <- RENTAL_SUBJECT_ALREADY_IN_USE (INC-008) - reachable
 *   because nothing today prevents creating two DRAFT rentals against the
 *   same rental_subject_id; the conflict only surfaces at activation time.
 *
 * RENTAL_NOT_FOUND, PRIMARY_SUBJECT_REQUIRED, ACTIVE_TENANT_REQUIRED,
 * ACTIVE_LESSOR_REQUIRED and PARKING_ALREADY_SUBLEASED remain deliberately
 * unmapped and fall back to 'unknown' - none of them is reachable through
 * any path this frontend exposes today (create_rental_draft already
 * atomically creates the PRIMARY subject and both ACTIVE participants, and
 * PARKING_ALREADY_SUBLEASED requires a sublease-authorization flow that has
 * no frontend implementation anywhere in this repo). Per-code UX for those
 * would be speculative and belongs to whichever increment actually builds
 * the flow that can reach them.
 */
export type RentalActivationErrorCode =
  | 'management_access_required'
  | 'capacity_reached'
  | 'terms_incomplete'
  | 'already_active'
  | 'subject_in_use'
  | 'unknown'

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
 * Known, user-facing failure categories for the three lifecycle RPCs
 * (cancel_draft_rental, start_ending_rental, end_rental) - a distinct family
 * from RentalActivationErrorCode because these RPCs raise a different
 * exception vocabulary (see toRentalLifecycleError's own doc comment for the
 * full RPC-string -> code mapping):
 *
 * - 'management_access_required' <- MANAGEMENT_ACCESS_REQUIRED
 *   (cancel_draft_rental only - the only one of the three RPCs gated by
 *   can_manage_administration(), i.e. role + subscription/
 *   management_access_until; start_ending_rental/end_rental check only
 *   has_administration_management_role(), no subscription check, so this
 *   code is unreachable through those two).
 * - 'not_draft' <- ONLY_DRAFT_CAN_BE_CANCELLED (cancel_draft_rental) -
 *   reachable via stale client state (two tabs, two people managing the
 *   same administration) where the rental left DRAFT elsewhere while this
 *   view still shows it as cancellable.
 * - 'not_active' <- RENTAL_NOT_ACTIVE (start_ending_rental) - same stale
 *   client state reasoning, for a rental that left ACTIVE elsewhere.
 * - 'not_endable' <- RENTAL_NOT_ENDABLE (end_rental) - same stale client
 *   state reasoning, for a rental that already left ACTIVE/ENDING
 *   elsewhere (e.g. another tab already ended it).
 * - 'end_before_start' <- END_BEFORE_START (end_rental) - reachable because
 *   real_start_date can be a future date; ending "today" via end_rental's
 *   own DEFAULT CURRENT_DATE would then be before it.
 *
 * RENTAL_NOT_FOUND (all three RPCs) and ADMINISTRATION_ROLE_REQUIRED
 * (start_ending_rental/end_rental) remain deliberately unmapped and fall
 * back to 'unknown' - RENTAL_NOT_FOUND is unreachable because every
 * relationshipId this frontend passes comes from a row it already read via
 * listByAdministration, and ADMINISTRATION_ROLE_REQUIRED is unreachable
 * because OWNER is the only administration role that exists in this MVP
 * (see has_administration_management_role()'s own gate) - per-code UX for
 * either would be speculative.
 */
export type RentalLifecycleErrorCode =
  | 'management_access_required'
  | 'not_draft'
  | 'not_active'
  | 'not_endable'
  | 'end_before_start'
  | 'unknown'

export class RentalLifecycleError extends Error {
  readonly code: RentalLifecycleErrorCode

  constructor(code: RentalLifecycleErrorCode, cause?: unknown) {
    super(`Rental lifecycle error: ${code}`)
    this.name = 'RentalLifecycleError'
    this.code = code
    this.cause = cause
  }
}

/**
 * Input for updateSchedule - the 4 rental_relationships columns
 * activate_rental_relationship requires to be non-null before DRAFT ->
 * ACTIVE can succeed (real_start_date, tracking_start_date, payment_day,
 * payment_timing), plus expected_end_date (nullable, optional at this
 * stage). realStartDate doubles as the first RentalTermVersion's
 * effectiveFrom at the call site (see useSaveRentalTerms) - it is not
 * collected twice.
 */
export interface RentalScheduleInput {
  realStartDate: string
  trackingStartDate: string
  paymentDay: number
  paymentTiming: PaymentTiming
  expectedEndDate: string | null
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
 * substitute for calling this. No cancel/end/getById here - lifecycle
 * beyond DRAFT creation, schedule entry and activation is out of scope for
 * this increment.
 *
 * updateSchedule issues a direct UPDATE on rental_relationships (no RPC
 * exists for this) - RLS-gated by rental_relationships_update_draft, which
 * only allows it while status = 'DRAFT' and the caller can manage the
 * administration. Same table listByAdministration/activate already read,
 * just a different operation on it. This writes the 4 columns
 * activate_rental_relationship requires before DRAFT -> ACTIVE can succeed
 * (see RentalScheduleInput's own doc comment) - it does not touch
 * rental_term_versions (see RentalTermsRepository for that, a separate
 * table/RLS/aggregate).
 *
 * cancelDraft calls cancel_draft_rental - the only way to transition
 * DRAFT -> CANCELLED. Gated by can_manage_administration() (role +
 * subscription/management_access_until), same authorization family as
 * createDraft/activate.
 *
 * startEnding calls start_ending_rental - the only way to transition
 * ACTIVE -> ENDING. Gated by has_administration_management_role() only - no
 * subscription check, deliberately: an authorized owner/manager can wind
 * down an existing rental even after subscription access has lapsed.
 *
 * end calls end_rental - the only way to transition ACTIVE or ENDING ->
 * ENDED. Same authorization as startEnding (role only, no subscription
 * check). Always called with only p_relationship_id - p_actual_end_date is
 * never sent from here, so the RPC's own DEFAULT CURRENT_DATE applies; no
 * backdated termination from this frontend.
 */
export interface RentalRepository {
  listByAdministration(administrationId: string): Promise<RentalRelationship[]>
  createDraft(input: CreateRentalDraftInput): Promise<CreateRentalDraftResult>
  activate(relationshipId: string): Promise<RentalRelationship>
  updateSchedule(relationshipId: string, input: RentalScheduleInput): Promise<RentalRelationship>
  cancelDraft(relationshipId: string): Promise<RentalRelationship>
  startEnding(relationshipId: string): Promise<RentalRelationship>
  end(relationshipId: string): Promise<RentalRelationship>
}
