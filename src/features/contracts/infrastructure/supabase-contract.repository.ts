import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  ContractRepositoryError,
  type Contract,
  type ContractErrorCode,
  type ContractOrigin,
  type ContractRepository,
  type ContractStatus,
  type ContractTermsSnapshot,
  type RegisterExternalSignedContractInput,
  type RegisterHabitexGeneratedContractInput,
} from '../domain/contract.types'

interface ContractRow {
  id: string
  administration_id: string
  rental_relationship_id: string
  origin: ContractOrigin
  status: ContractStatus
  version_number: number
  document_file_id: string | null
  signed_file_id: string | null
  terms_snapshot: ContractTermsSnapshot
  document_hash: string | null
  generated_at: string | null
  shared_at: string | null
  signed_at: string | null
  terminated_at: string | null
  created_at: string
  updated_at: string
}

const CONTRACT_COLUMNS =
  'id, administration_id, rental_relationship_id, origin, status, version_number, document_file_id, signed_file_id, terms_snapshot, document_hash, generated_at, shared_at, signed_at, terminated_at, created_at, updated_at'

function toContract(row: ContractRow): Contract {
  return {
    id: row.id,
    administrationId: row.administration_id,
    rentalRelationshipId: row.rental_relationship_id,
    origin: row.origin,
    status: row.status,
    versionNumber: row.version_number,
    documentFileId: row.document_file_id,
    signedFileId: row.signed_file_id,
    termsSnapshot: row.terms_snapshot,
    documentHash: row.document_hash,
    generatedAt: row.generated_at,
    sharedAt: row.shared_at,
    signedAt: row.signed_at,
    terminatedAt: row.terminated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** The two registration RPCs return table(...), which PostgREST can
 * serialize as a one-element array or a single object depending on the
 * client version - handled defensively rather than assumed (same pattern as
 * supabase-rental.repository.ts's own firstRow). */
function firstRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null
  return data
}

function toRegisterHabitexGeneratedRpcArgs(input: RegisterHabitexGeneratedContractInput) {
  return {
    p_relationship_id: input.rentalRelationshipId,
    p_document_file_id: input.documentFileId,
    p_document_hash: input.documentHash,
    p_terms_snapshot: input.termsSnapshot,
  }
}

function toRegisterExternalSignedRpcArgs(input: RegisterExternalSignedContractInput) {
  return {
    p_relationship_id: input.rentalRelationshipId,
    p_signed_file_id: input.signedFileId,
    p_terms_snapshot: input.termsSnapshot,
  }
}

/**
 * Translates a failed Supabase call (RPC exception string, or a Postgres
 * error surfaced from a direct UPDATE) into our own ContractRepositoryError
 * - see ContractErrorCode's own doc comment for the exact mapping. The
 * Postgres 23505 (unique_violation) check is by error code, never by
 * matching a message string, because it is a real constraint violation
 * (contracts_rental_relationship_id_version_number_key), not an
 * application-level RAISE EXCEPTION.
 *
 * markShared/terminate's zero-rows-matched race (the guarded UPDATE's
 * .eq('status', ...) didn't match, or RLS's own can_manage_administration()
 * check silently excluded the row - both surface identically, as a
 * zero-rows update) has no corresponding backend exception string, so it
 * falls through to 'unknown' here, same as every other unmatched error.
 */
function toContractRepositoryError(error: { message: string; code?: string }): ContractRepositoryError {
  if (error.code === '23505') {
    return new ContractRepositoryError('version_conflict', error)
  }

  if (error.message === 'MANAGEMENT_ACCESS_REQUIRED') {
    return new ContractRepositoryError('management_access_required', error)
  }

  if (
    error.message === 'RENTAL_NOT_FOUND' ||
    error.message === 'CONTRACT_NOT_FOUND' ||
    error.message === 'DOCUMENT_FILE_NOT_FOUND' ||
    error.message === 'SIGNED_FILE_NOT_FOUND'
  ) {
    return new ContractRepositoryError('not_found', error)
  }

  if (error.message === 'INVALID_DOCUMENT_HASH') {
    return new ContractRepositoryError('invalid_document_hash', error)
  }

  if (error.message === 'CONTRACT_NOT_SIGNABLE') {
    return new ContractRepositoryError('not_signable', error)
  }

  const unknownCode: ContractErrorCode = 'unknown'
  return new ContractRepositoryError(unknownCode, error)
}

export const supabaseContractRepository: ContractRepository = {
  async listByRelationship(rentalRelationshipId: string): Promise<Contract[]> {
    // administration scoping is implicit via rental_relationship_id - RLS
    // (contracts_select, can_view_relationship) remains the real authority.
    // Ordered newest-version-first, matching how RentalContractsPage
    // presents contract history.
    const { data, error } = await supabaseClient
      .from('contracts')
      .select(CONTRACT_COLUMNS)
      .eq('rental_relationship_id', rentalRelationshipId)
      .order('version_number', { ascending: false })

    if (error) {
      throw toContractRepositoryError(error)
    }

    return (data as ContractRow[]).map(toContract)
  },

  async registerHabitexGenerated(input: RegisterHabitexGeneratedContractInput): Promise<Contract> {
    // can_manage_administration(), file existence/administration match,
    // document_hash format, and version_number computation all happen
    // inside the RPC (SECURITY DEFINER) - no direct INSERT, ever (see
    // ContractRepository's own doc comment).
    const response = await supabaseClient.rpc(
      'register_habitex_generated_contract',
      toRegisterHabitexGeneratedRpcArgs(input),
    )

    if (response.error) {
      throw toContractRepositoryError(response.error)
    }

    const row = firstRow(response.data as ContractRow | ContractRow[] | null)
    if (!row) {
      throw new ContractRepositoryError('unknown', new Error('register_habitex_generated_contract returned no row'))
    }

    return toContract(row)
  },

  async registerExternalSigned(input: RegisterExternalSignedContractInput): Promise<Contract> {
    // Same reasoning as registerHabitexGenerated - can_manage_administration(),
    // file existence/administration match and version_number computation all
    // happen inside the RPC. No direct INSERT.
    const response = await supabaseClient.rpc(
      'register_external_signed_contract',
      toRegisterExternalSignedRpcArgs(input),
    )

    if (response.error) {
      throw toContractRepositoryError(response.error)
    }

    const row = firstRow(response.data as ContractRow | ContractRow[] | null)
    if (!row) {
      throw new ContractRepositoryError('unknown', new Error('register_external_signed_contract returned no row'))
    }

    return toContract(row)
  },

  async attachSignedCopy(contractId: string, signedFileId: string): Promise<Contract> {
    // can_manage_administration(), origin='HABITEX' AND status IN
    // ('GENERATED','SHARED') and file existence/administration match all
    // happen inside the RPC.
    const response = await supabaseClient.rpc('attach_signed_contract_copy', {
      p_contract_id: contractId,
      p_signed_file_id: signedFileId,
    })

    if (response.error) {
      throw toContractRepositoryError(response.error)
    }

    const row = firstRow(response.data as ContractRow | ContractRow[] | null)
    if (!row) {
      throw new ContractRepositoryError('unknown', new Error('attach_signed_contract_copy returned no row'))
    }

    return toContract(row)
  },

  async markShared(contractId: string): Promise<Contract> {
    // No RPC exists for this transition (see ContractRepository's own doc
    // comment). The .eq('status', 'GENERATED') guard is essential, not
    // optional - without it, a stale/racing client could move an already
    // SIGNED contract "back" to SHARED, which RLS alone would not prevent
    // (contracts_update only requires can_manage_administration() and
    // status <> 'TERMINATED'). .single() turns a zero-row match (the guard
    // didn't apply) into a real, detectable error instead of a misleading
    // silent "success".
    const { data, error } = await supabaseClient
      .from('contracts')
      .update({ status: 'SHARED', shared_at: new Date().toISOString() })
      .eq('id', contractId)
      .eq('status', 'GENERATED')
      .select(CONTRACT_COLUMNS)
      .single()

    if (error) {
      throw toContractRepositoryError(error)
    }

    return toContract(data)
  },

  async terminate(contractId: string): Promise<Contract> {
    // No RPC exists for this transition either. Only SIGNED -> TERMINATED
    // is the supported lifecycle transition (product decision) - the
    // .eq('status', 'SIGNED') guard enforces that even though RLS alone
    // would allow GENERATED/SHARED -> TERMINATED too. Same zero-rows-match
    // race detection as markShared.
    const { data, error } = await supabaseClient
      .from('contracts')
      .update({ status: 'TERMINATED', terminated_at: new Date().toISOString() })
      .eq('id', contractId)
      .eq('status', 'SIGNED')
      .select(CONTRACT_COLUMNS)
      .single()

    if (error) {
      throw toContractRepositoryError(error)
    }

    return toContract(data)
  },
}
