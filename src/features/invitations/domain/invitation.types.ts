/**
 * secure_actions.status, confirmed against the deployed schema, scoped here
 * to action_type='TENANT_INVITATION' rows only.
 */
export type InvitationStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'REVOKED'

/**
 * A public.secure_actions row (action_type='TENANT_INVITATION' only), mirrored
 * into camelCase domain shape. Every column confirmed against the deployed
 * schema - no field invented here.
 */
export interface TenantInvitation {
  id: string
  administrationId: string
  personId: string
  rentalRelationshipId: string | null
  status: InvitationStatus
  expiresAt: string
  createdAt: string
}

/** Input for InvitationRepository.createInvitation - mirrors create_tenant_invitation's own args. */
export interface CreateTenantInvitationInput {
  administrationId: string
  personId: string
  rentalRelationshipId: string
  tokenHash: string
  expiresAt: string
}

/**
 * Known, user-facing failure categories across create_tenant_invitation/
 * claim_tenant_invitation - deliberately coarse, mirroring this codebase's
 * established XErrorCode shape. Mapping (human-approved, do not deviate):
 * - 'management_access_required' <- MANAGEMENT_ACCESS_REQUIRED (create only)
 * - 'tenant_not_linked' <- TENANT_NOT_IN_ADMINISTRATION (create only)
 * - 'authentication_required' <- AUTHENTICATION_REQUIRED (claim only - expected
 *   pre-auth state, not necessarily an "error" the UI treats as a failure)
 * - 'invalid_token' <- TOKEN_REQUIRED | INVITATION_NOT_FOUND | INVITATION_REVOKED (claim only)
 * - 'already_claimed' <- INVITATION_NOT_PENDING | PERSON_ALREADY_LINKED_TO_ANOTHER_ACCOUNT (claim only)
 * - 'expired' <- INVITATION_EXPIRED (claim only)
 * - 'account_conflict' <- ACCOUNT_ALREADY_LINKED_TO_ANOTHER_PERSON (claim only)
 * - 'unknown' <- everything else, including EXPIRY_MUST_BE_FUTURE/INVALID_TOKEN_HASH/
 *   RENTAL_ADMINISTRATION_MISMATCH/INVITATION_PERSON_REQUIRED - all unreachable through
 *   this frontend's own flow (expiry/hash are always computed correctly by this code,
 *   relationship/administration always come from an already-loaded pair, person_id is
 *   always set by create), so they stay unmapped rather than getting speculative codes.
 */
export type InvitationErrorCode =
  | 'management_access_required'
  | 'tenant_not_linked'
  | 'authentication_required'
  | 'invalid_token'
  | 'already_claimed'
  | 'expired'
  | 'account_conflict'
  | 'unknown'

export class InvitationRepositoryError extends Error {
  readonly code: InvitationErrorCode

  constructor(code: InvitationErrorCode, cause?: unknown) {
    super(`Invitation repository error: ${code}`)
    this.name = 'InvitationRepositoryError'
    this.code = code
    this.cause = cause
  }
}

/**
 * public.secure_actions (TENANT_INVITATION only) port. createInvitation (via
 * create_tenant_invitation) never receives the raw token - only its SHA-256 hex hash,
 * computed entirely client-side by the caller (see sha256Hex.ts in this same domain
 * folder). claim (via claim_tenant_invitation) receives the raw token as-is; that RPC
 * hashes it server-side itself. Neither this port nor its infrastructure implementation
 * ever compares email or document_number for identity linking - the deployed backend
 * doesn't either, and this port must not introduce that logic.
 */
export interface InvitationRepository {
  createInvitation(input: CreateTenantInvitationInput): Promise<TenantInvitation>
  /** Returns void deliberately - the claimed public.people row's fields are never
   * displayed anywhere in this MVP flow (the page just navigates to '/' on success),
   * so there is no reason to define/expose a Person shape this port doesn't need. */
  claim(rawToken: string): Promise<void>
}
