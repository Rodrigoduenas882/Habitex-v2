import type { AdministrationFeeMode, UtilitiesResponsibility } from '@/features/rentals/domain/rental-terms.types'
import type { PaymentTiming } from '@/features/rentals/domain/rental.types'

/** contract_origin, confirmed against the deployed schema (public.contracts). */
export type ContractOrigin = 'HABITEX' | 'EXTERNAL'

/**
 * contract_status, confirmed against the deployed schema
 * (public.contracts). DRAFT is included here only for read-path
 * exhaustiveness - no RPC and no direct write this frontend performs ever
 * produces it (see ContractRepository's own doc comment); nothing in this
 * increment builds a "create DRAFT contract" flow.
 */
export type ContractStatus = 'DRAFT' | 'GENERATED' | 'SHARED' | 'SIGNED' | 'TERMINATED'

/**
 * A public.contracts row, mirrored into camelCase domain shape.
 * documentFileId/signedFileId are nullable independently - a HABITEX-origin
 * contract has documentFileId set from registration and signedFileId set
 * only once a signed copy is later attached (attach_signed_contract_copy);
 * an EXTERNAL-origin contract has only signedFileId, set at registration.
 */
export interface Contract {
  id: string
  administrationId: string
  rentalRelationshipId: string
  origin: ContractOrigin
  status: ContractStatus
  versionNumber: number
  documentFileId: string | null
  signedFileId: string | null
  termsSnapshot: ContractTermsSnapshot
  documentHash: string | null
  generatedAt: string | null
  sharedAt: string | null
  signedAt: string | null
  terminatedAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * The shape stored in contracts.terms_snapshot (jsonb) at registration time.
 * Deliberately combines the current RentalTermVersion's own fields
 * (rentAmount/administrationMode/utilitiesMode - the financial terms, see
 * rental-terms.types.ts) with the parent RentalRelationship's own schedule
 * fields (effectiveFrom/realStartDate/trackingStartDate/paymentDay/
 * paymentTiming/expectedEndDate) - both already established by INC-006 as
 * "the rental's terms", nothing invented beyond what those two types already
 * carry. Once stored on a contract row, this is frozen historical data - a
 * later change to the relationship's live terms must never be reflected
 * back onto an already-registered contract; nothing in this feature
 * re-derives or "refreshes" it for an existing contract.
 */
export interface ContractTermsSnapshot {
  rentAmount: number
  administrationMode: AdministrationFeeMode
  utilitiesMode: UtilitiesResponsibility | null
  effectiveFrom: string
  realStartDate: string
  trackingStartDate: string
  paymentDay: number
  paymentTiming: PaymentTiming
  expectedEndDate: string | null
}

/** Input for ContractRepository.registerHabitexGenerated (register_habitex_generated_contract). */
export interface RegisterHabitexGeneratedContractInput {
  administrationId: string
  rentalRelationshipId: string
  documentFileId: string
  documentHash: string
  termsSnapshot: ContractTermsSnapshot
}

/** Input for ContractRepository.registerExternalSigned (register_external_signed_contract). */
export interface RegisterExternalSignedContractInput {
  administrationId: string
  rentalRelationshipId: string
  signedFileId: string
  termsSnapshot: ContractTermsSnapshot
}

/**
 * Known, user-facing failure categories across all six ContractRepository
 * methods - deliberately coarse, mirroring RentalActivationError's shape
 * (see toContractRepositoryError's own doc comment for the full mapping):
 *
 * - 'management_access_required' <- MANAGEMENT_ACCESS_REQUIRED (all three
 *   RPCs, plus the two guarded direct UPDATEs failing RLS the same way).
 * - 'not_found' <- RENTAL_NOT_FOUND / CONTRACT_NOT_FOUND /
 *   DOCUMENT_FILE_NOT_FOUND / SIGNED_FILE_NOT_FOUND, coarse-grouped - all
 *   mean "the referenced thing doesn't exist or isn't accessible to you".
 * - 'invalid_document_hash' <- INVALID_DOCUMENT_HASH
 *   (register_habitex_generated_contract only).
 * - 'not_signable' <- CONTRACT_NOT_SIGNABLE (attach_signed_contract_copy
 *   only - origin/status precondition not met).
 * - 'version_conflict' <- a Postgres 23505 unique_violation on
 *   contracts_rental_relationship_id_version_number_key (registration RPCs
 *   only - see this feature's own research notes on the known,
 *   accepted version-number race). A real Postgres constraint violation, not
 *   a RAISE EXCEPTION string - detected via the error's `.code`, never by
 *   matching a message string.
 * - 'unknown' <- everything else (unmatched RPC exception strings, plain
 *   Supabase/network failures, and the markShared/terminate zero-rows-
 *   matched race - see ContractRepository's own doc comment for why that
 *   race is deliberately reported as 'unknown' rather than a new code: it
 *   has no corresponding backend exception string to map, only a client-
 *   observed "0 rows returned from an UPDATE that should have matched 1").
 */
export type ContractErrorCode =
  | 'management_access_required'
  | 'not_found'
  | 'invalid_document_hash'
  | 'not_signable'
  | 'version_conflict'
  | 'unknown'

export class ContractRepositoryError extends Error {
  readonly code: ContractErrorCode

  constructor(code: ContractErrorCode, cause?: unknown) {
    super(`Contract repository error: ${code}`)
    this.name = 'ContractRepositoryError'
    this.code = code
    this.cause = cause
  }
}

/**
 * public.contracts port. Every write path here mirrors the exact backend
 * mechanism confirmed for this increment - there is no other way to create
 * or transition a contract row from this frontend:
 *
 * - listByRelationship: direct SELECT, scoped by rental_relationship_id.
 *   RLS (contracts_select) is the real authority (can_view_relationship) -
 *   this filter expresses scope, not security.
 *
 * - registerHabitexGenerated: register_habitex_generated_contract RPC
 *   (SECURITY DEFINER). The only path that creates a HABITEX-origin
 *   contract row, always at status='GENERATED'. Never a raw INSERT - RLS
 *   (contracts_insert) would technically allow one from a caller who can
 *   manage the administration and view the relationship, but version_number
 *   computation (max(existing)+1) and generated_at/origin/status are the
 *   RPC's own responsibility, not this frontend's to replicate.
 *
 * - registerExternalSigned: register_external_signed_contract RPC (SECURITY
 *   DEFINER). The only path that creates an EXTERNAL-origin contract row,
 *   always at status='SIGNED'. Same "never a raw INSERT" reasoning as
 *   registerHabitexGenerated.
 *
 * - attachSignedCopy: attach_signed_contract_copy RPC (SECURITY DEFINER).
 *   The only path that attaches signed_file_id to an existing HABITEX
 *   contract and transitions it GENERATED|SHARED -> SIGNED. Rejects
 *   (CONTRACT_NOT_SIGNABLE) if the contract isn't in one of those two
 *   statuses/origins.
 *
 * - markShared: NO RPC EXISTS for this transition. A direct UPDATE, guarded
 *   by `.eq('status', 'GENERATED')` in addition to `.eq('id', contractId)` -
 *   this guard is load-bearing, not optional: RLS (contracts_update) only
 *   requires can_manage_administration() and status <> 'TERMINATED', so
 *   without this extra guard a stale/racing client could move an already
 *   SIGNED contract "back" to SHARED, which must never happen. Uses
 *   .select(...).single() so a zero-row match (the guard didn't apply -
 *   someone else already changed the status) surfaces as a real,
 *   detectable failure via Supabase's own single-row-expected error,
 *   instead of silently reporting success.
 *
 * - terminate: NO RPC EXISTS for this transition either. Same reasoning as
 *   markShared: a direct UPDATE guarded by `.eq('status', 'SIGNED')` in
 *   addition to `.eq('id', contractId)` - only SIGNED -> TERMINATED is the
 *   supported lifecycle transition (product decision), not GENERATED/SHARED
 *   -> TERMINATED, even though RLS alone would not prevent those. Same
 *   zero-rows-matched race detection via .single().
 */
export interface ContractRepository {
  listByRelationship(rentalRelationshipId: string): Promise<Contract[]>
  registerHabitexGenerated(input: RegisterHabitexGeneratedContractInput): Promise<Contract>
  registerExternalSigned(input: RegisterExternalSignedContractInput): Promise<Contract>
  attachSignedCopy(contractId: string, signedFileId: string): Promise<Contract>
  markShared(contractId: string): Promise<Contract>
  terminate(contractId: string): Promise<Contract>
}
