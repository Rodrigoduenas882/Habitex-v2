import { describe, expect, it, vi } from 'vitest'
import { InvitationRepositoryError } from '../domain/invitation.types'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: { rpc },
}))

import { supabaseInvitationRepository } from './supabase-invitation.repository'

const INVITATION_ROW = {
  id: 'invitation-1',
  administration_id: 'admin-1',
  person_id: 'person-1',
  rental_relationship_id: 'rel-1',
  status: 'PENDING' as const,
  expires_at: '2026-01-12T00:00:00Z',
  created_at: '2026-01-05T00:00:00Z',
}

const INVITATION_DOMAIN = {
  id: 'invitation-1',
  administrationId: 'admin-1',
  personId: 'person-1',
  rentalRelationshipId: 'rel-1',
  status: 'PENDING',
  expiresAt: '2026-01-12T00:00:00Z',
  createdAt: '2026-01-05T00:00:00Z',
}

const CREATE_INPUT = {
  administrationId: 'admin-1',
  personId: 'person-1',
  rentalRelationshipId: 'rel-1',
  tokenHash: 'a'.repeat(64),
  expiresAt: '2026-01-12T00:00:00Z',
}

describe('supabaseInvitationRepository.createInvitation', () => {
  it('calls create_tenant_invitation with exactly the 5 expected keys, never a raw token', async () => {
    rpc.mockResolvedValueOnce({ data: INVITATION_ROW, error: null })

    await supabaseInvitationRepository.createInvitation(CREATE_INPUT)

    expect(rpc).toHaveBeenCalledWith('create_tenant_invitation', {
      p_administration_id: 'admin-1',
      p_person_id: 'person-1',
      p_rental_relationship_id: 'rel-1',
      p_token_hash: 'a'.repeat(64),
      p_expires_at: '2026-01-12T00:00:00Z',
    })
    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(Object.keys(args)).toEqual([
      'p_administration_id',
      'p_person_id',
      'p_rental_relationship_id',
      'p_token_hash',
      'p_expires_at',
    ])
  })

  it('maps the returned single row to domain shape', async () => {
    rpc.mockResolvedValueOnce({ data: INVITATION_ROW, error: null })

    const result = await supabaseInvitationRepository.createInvitation(CREATE_INPUT)

    expect(result).toEqual(INVITATION_DOMAIN)
  })

  it('throws InvitationRepositoryError with code unknown when the RPC returns no row (defensive, unreachable per the deployed function body)', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })

    const error = await supabaseInvitationRepository.createInvitation(CREATE_INPUT).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(InvitationRepositoryError)
    expect((error as InvitationRepositoryError).code).toBe('unknown')
  })

  it('maps MANAGEMENT_ACCESS_REQUIRED to code management_access_required', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'MANAGEMENT_ACCESS_REQUIRED' } })

    const error = await supabaseInvitationRepository.createInvitation(CREATE_INPUT).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(InvitationRepositoryError)
    expect((error as InvitationRepositoryError).code).toBe('management_access_required')
  })

  it('maps TENANT_NOT_IN_ADMINISTRATION to code tenant_not_linked', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'TENANT_NOT_IN_ADMINISTRATION' } })

    const error = await supabaseInvitationRepository.createInvitation(CREATE_INPUT).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(InvitationRepositoryError)
    expect((error as InvitationRepositoryError).code).toBe('tenant_not_linked')
  })

  it('maps an unmapped exception string (e.g. EXPIRY_MUST_BE_FUTURE) to code unknown', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'EXPIRY_MUST_BE_FUTURE' } })

    const error = await supabaseInvitationRepository.createInvitation(CREATE_INPUT).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(InvitationRepositoryError)
    expect((error as InvitationRepositoryError).code).toBe('unknown')
  })
})

describe('supabaseInvitationRepository.claim', () => {
  it('calls claim_tenant_invitation with exactly {p_token: rawToken} - the raw token, never a hash', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'person-1' }, error: null })

    await supabaseInvitationRepository.claim('raw-token-value')

    expect(rpc).toHaveBeenCalledWith('claim_tenant_invitation', { p_token: 'raw-token-value' })
    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(Object.keys(args)).toEqual(['p_token'])
  })

  it('resolves without reading the returned people row', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'person-1' }, error: null })

    await expect(supabaseInvitationRepository.claim('raw-token-value')).resolves.toBeUndefined()
  })

  it('maps AUTHENTICATION_REQUIRED to code authentication_required', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'AUTHENTICATION_REQUIRED' } })

    const error = await supabaseInvitationRepository.claim('raw-token-value').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(InvitationRepositoryError)
    expect((error as InvitationRepositoryError).code).toBe('authentication_required')
  })

  it('maps TOKEN_REQUIRED to code invalid_token', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'TOKEN_REQUIRED' } })

    const error = await supabaseInvitationRepository.claim('').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(InvitationRepositoryError)
    expect((error as InvitationRepositoryError).code).toBe('invalid_token')
  })

  it('maps INVITATION_NOT_FOUND to code invalid_token', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'INVITATION_NOT_FOUND' } })

    const error = await supabaseInvitationRepository.claim('raw-token-value').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(InvitationRepositoryError)
    expect((error as InvitationRepositoryError).code).toBe('invalid_token')
  })

  it('maps INVITATION_REVOKED to code invalid_token', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'INVITATION_REVOKED' } })

    const error = await supabaseInvitationRepository.claim('raw-token-value').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(InvitationRepositoryError)
    expect((error as InvitationRepositoryError).code).toBe('invalid_token')
  })

  it('maps INVITATION_NOT_PENDING to code already_claimed', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'INVITATION_NOT_PENDING' } })

    const error = await supabaseInvitationRepository.claim('raw-token-value').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(InvitationRepositoryError)
    expect((error as InvitationRepositoryError).code).toBe('already_claimed')
  })

  it('maps PERSON_ALREADY_LINKED_TO_ANOTHER_ACCOUNT to code already_claimed', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'PERSON_ALREADY_LINKED_TO_ANOTHER_ACCOUNT' } })

    const error = await supabaseInvitationRepository.claim('raw-token-value').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(InvitationRepositoryError)
    expect((error as InvitationRepositoryError).code).toBe('already_claimed')
  })

  it('maps INVITATION_EXPIRED to code expired', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'INVITATION_EXPIRED' } })

    const error = await supabaseInvitationRepository.claim('raw-token-value').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(InvitationRepositoryError)
    expect((error as InvitationRepositoryError).code).toBe('expired')
  })

  it('maps ACCOUNT_ALREADY_LINKED_TO_ANOTHER_PERSON to code account_conflict', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'ACCOUNT_ALREADY_LINKED_TO_ANOTHER_PERSON' } })

    const error = await supabaseInvitationRepository.claim('raw-token-value').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(InvitationRepositoryError)
    expect((error as InvitationRepositoryError).code).toBe('account_conflict')
  })

  it('maps an unmapped exception string (e.g. INVITATION_PERSON_REQUIRED) to code unknown', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'INVITATION_PERSON_REQUIRED' } })

    const error = await supabaseInvitationRepository.claim('raw-token-value').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(InvitationRepositoryError)
    expect((error as InvitationRepositoryError).code).toBe('unknown')
  })
})
