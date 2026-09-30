import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  InvitationRepositoryError,
  type CreateTenantInvitationInput,
  type InvitationErrorCode,
  type InvitationRepository,
  type InvitationStatus,
  type TenantInvitation,
} from '../domain/invitation.types'

interface TenantInvitationRow {
  id: string
  administration_id: string
  person_id: string
  rental_relationship_id: string | null
  status: InvitationStatus
  expires_at: string
  created_at: string
}

function toTenantInvitation(row: TenantInvitationRow): TenantInvitation {
  return {
    id: row.id,
    administrationId: row.administration_id,
    personId: row.person_id,
    rentalRelationshipId: row.rental_relationship_id,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

function toCreateTenantInvitationRpcArgs(input: CreateTenantInvitationInput) {
  return {
    p_administration_id: input.administrationId,
    p_person_id: input.personId,
    p_rental_relationship_id: input.rentalRelationshipId,
    p_token_hash: input.tokenHash,
    p_expires_at: input.expiresAt,
  }
}

/**
 * Translates a failed Supabase call (create_tenant_invitation/
 * claim_tenant_invitation's RPC exception string) into our own
 * InvitationRepositoryError - see InvitationErrorCode's own doc comment for
 * the exact mapping. Never compares email or document_number - the deployed
 * backend doesn't either, identity linking is exclusively token-possession-
 * based.
 */
function toInvitationRepositoryError(error: { message: string }): InvitationRepositoryError {
  if (error.message === 'MANAGEMENT_ACCESS_REQUIRED') {
    return new InvitationRepositoryError('management_access_required', error)
  }

  if (error.message === 'TENANT_NOT_IN_ADMINISTRATION') {
    return new InvitationRepositoryError('tenant_not_linked', error)
  }

  if (error.message === 'AUTHENTICATION_REQUIRED') {
    return new InvitationRepositoryError('authentication_required', error)
  }

  if (error.message === 'TOKEN_REQUIRED' || error.message === 'INVITATION_NOT_FOUND' || error.message === 'INVITATION_REVOKED') {
    return new InvitationRepositoryError('invalid_token', error)
  }

  if (error.message === 'INVITATION_NOT_PENDING' || error.message === 'PERSON_ALREADY_LINKED_TO_ANOTHER_ACCOUNT') {
    return new InvitationRepositoryError('already_claimed', error)
  }

  if (error.message === 'INVITATION_EXPIRED') {
    return new InvitationRepositoryError('expired', error)
  }

  if (error.message === 'ACCOUNT_ALREADY_LINKED_TO_ANOTHER_PERSON') {
    return new InvitationRepositoryError('account_conflict', error)
  }

  // EXPIRY_MUST_BE_FUTURE/INVALID_TOKEN_HASH/RENTAL_ADMINISTRATION_MISMATCH/
  // INVITATION_PERSON_REQUIRED all fall through to 'unknown' - unreachable
  // through this frontend's own flow (see InvitationErrorCode's own doc
  // comment).
  const unknownCode: InvitationErrorCode = 'unknown'
  return new InvitationRepositoryError(unknownCode, error)
}

export const supabaseInvitationRepository: InvitationRepository = {
  async createInvitation(input: CreateTenantInvitationInput): Promise<TenantInvitation> {
    // can_manage_administration(), expiry/token-hash validation and the
    // INSERT itself all happen inside the RPC (SECURITY DEFINER) - no direct
    // INSERT against secure_actions, ever. The raw token never reaches this
    // call - input.tokenHash is the only token-shaped field this function's
    // own input type can carry.
    const response = await supabaseClient.rpc('create_tenant_invitation', toCreateTenantInvitationRpcArgs(input))

    if (response.error) {
      throw toInvitationRepositoryError(response.error)
    }

    const row = response.data as TenantInvitationRow | null
    if (!row) {
      throw new InvitationRepositoryError('unknown', new Error('create_tenant_invitation returned no row'))
    }

    return toTenantInvitation(row)
  },

  async claim(rawToken: string): Promise<void> {
    // auth.uid() check, hash lookup (the RPC hashes rawToken server-side
    // itself), status/expiry/revocation checks and the accounts INSERT all
    // happen inside the RPC (SECURITY DEFINER) - no direct INSERT against
    // accounts or secure_actions, ever. The returned people row is
    // deliberately not read (see InvitationRepository.claim's own doc
    // comment) - nothing downstream needs it.
    const response = await supabaseClient.rpc('claim_tenant_invitation', { p_token: rawToken })

    if (response.error) {
      throw toInvitationRepositoryError(response.error)
    }
  },
}
