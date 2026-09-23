/** administration_fee_mode, confirmed against the deployed schema. */
export type AdministrationFeeMode = 'NONE' | 'INCLUDED' | 'TENANT_DIRECT'

/** utilities_responsibility, confirmed against the deployed schema. */
export type UtilitiesResponsibility = 'TENANT' | 'LESSOR' | 'SPECIAL_AGREEMENT'

/**
 * A rental_term_versions row. Deliberately does not carry special_terms
 * (jsonb) - out of scope for this increment, not exposed anywhere in the
 * domain layer, and never written to on insert (see
 * CreateRentalTermVersionInput). Does not carry versionNumber semantics
 * beyond the raw number itself - this increment only ever creates/reads
 * version 1 (see CreateRentalTermVersionInput and
 * RentalTermsRepository.getCurrent's own doc comments); a future increment
 * that adds editing/history would be the place to make versioning a real
 * concept in the UI.
 */
export interface RentalTermVersion {
  id: string
  rentalRelationshipId: string
  versionNumber: number
  effectiveFrom: string
  effectiveUntil: string | null
  rentAmount: number
  administrationMode: AdministrationFeeMode
  utilitiesMode: UtilitiesResponsibility | null
  createdAt: string
}

/**
 * Input for RentalTermsRepository.create. No effectiveUntil (always
 * null/open-ended for a first version) and no versionNumber (this
 * repository only ever creates the first version of a relationship, never a
 * subsequent one - "a DRAFT rental can receive its terms" is this
 * increment's whole acceptance criterion, not versioning/history; a later
 * increment can add a real "new version" flow if product asks for one).
 */
export interface CreateRentalTermVersionInput {
  rentalRelationshipId: string
  effectiveFrom: string
  rentAmount: number
  administrationMode: AdministrationFeeMode
  utilitiesMode: UtilitiesResponsibility | null
}

/** Wraps a failed Supabase call so nothing above infrastructure/ ever sees a raw PostgrestError. */
export class RentalTermsRepositoryError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'RentalTermsRepositoryError'
    this.cause = cause
  }
}

/**
 * rental_term_versions is a separate table/RLS/aggregate from
 * rental_relationships (see RentalRepository's own doc comment) - direct
 * insert/select here, no RPC exists for it. rental_terms_insert only allows
 * a write while the parent rental_relationship is still DRAFT
 * (RLS-enforced, not re-checked client-side); rental_terms_select is
 * broader (any can_view_relationship() participant, including tenants).
 *
 * create always inserts version_number = 1 and effective_until = null (see
 * CreateRentalTermVersionInput's own doc comment) - it is not a general
 * "add a term version" API.
 *
 * getCurrent orders by version_number descending, limit 1. Since this
 * increment never creates more than one version, this is simply "the one
 * version if it exists yet" - not real "current vs. historical" versioning
 * logic.
 *
 * listRelationshipIdsWithTerms (INC-008) is the precise, non-heuristic
 * signal for "does this DRAFT rental have terms yet" - as opposed to
 * inferring it from rental_relationships' own schedule columns alone
 * (real_start_date/tracking_start_date/payment_day/payment_timing), which
 * could theoretically be set without a rental_term_versions row existing
 * (see useSaveRentalTerms's documented partial-failure case, where
 * updateSchedule succeeds but create fails). Takes a batch of relationship
 * ids and returns the subset that already have at least one term version, in
 * a single `.in(...)` query - not N+1 - because this is a UX-readiness read
 * (e.g. gating the "Activar" action on the rentals list), not a new
 * aggregate. Same rental_terms_select RLS policy already covers it
 * (can_view_relationship, broader than can_manage_administration) - no RPC.
 */
export interface RentalTermsRepository {
  create(input: CreateRentalTermVersionInput): Promise<RentalTermVersion>
  getCurrent(rentalRelationshipId: string): Promise<RentalTermVersion | null>
  listRelationshipIdsWithTerms(rentalRelationshipIds: string[]): Promise<Set<string>>
}
