import { describe, expect, it, vi } from 'vitest'
import {
  ContractRepositoryError,
  type RegisterExternalSignedContractInput,
  type RegisterHabitexGeneratedContractInput,
} from '../domain/contract.types'

const { order, selectEq, single, updateEqStatus, updateEqId, update, from, rpc } = vi.hoisted(() => {
  const order = vi.fn()
  const selectEq = vi.fn((_column: string, _value: string) => ({ order }))
  const select = vi.fn((_columns: string) => ({ eq: selectEq }))

  const single = vi.fn()
  const updateSelect = vi.fn((_columns: string) => ({ single }))
  const updateEqStatus = vi.fn((_column: string, _value: string) => ({ select: updateSelect }))
  const updateEqId = vi.fn((_column: string, _value: string) => ({ eq: updateEqStatus }))
  const update = vi.fn((_values: Record<string, unknown>) => ({ eq: updateEqId }))

  const from = vi.fn((_table: string) => ({ select, update }))
  const rpc = vi.fn()

  return { order, selectEq, single, updateEqStatus, updateEqId, update, from, rpc }
})

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: { from, rpc },
}))

import { supabaseContractRepository } from './supabase-contract.repository'

const TERMS_SNAPSHOT = {
  rentAmount: 1_500_000,
  administrationMode: 'INCLUDED' as const,
  utilitiesMode: 'TENANT' as const,
  effectiveFrom: '2026-01-01',
  realStartDate: '2026-01-01',
  trackingStartDate: '2026-01-05',
  paymentDay: 5,
  paymentTiming: 'ADVANCE' as const,
  expectedEndDate: null,
}

const CONTRACT_ROW = {
  id: 'contract-1',
  administration_id: 'admin-1',
  rental_relationship_id: 'rel-1',
  origin: 'HABITEX' as const,
  status: 'GENERATED' as const,
  version_number: 1,
  document_file_id: 'file-1',
  signed_file_id: null,
  terms_snapshot: TERMS_SNAPSHOT,
  document_hash: 'a'.repeat(64),
  generated_at: '2026-01-01T00:00:00Z',
  shared_at: null,
  signed_at: null,
  terminated_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const CONTRACT_DOMAIN = {
  id: 'contract-1',
  administrationId: 'admin-1',
  rentalRelationshipId: 'rel-1',
  origin: 'HABITEX' as const,
  status: 'GENERATED' as const,
  versionNumber: 1,
  documentFileId: 'file-1',
  signedFileId: null,
  termsSnapshot: TERMS_SNAPSHOT,
  documentHash: 'a'.repeat(64),
  generatedAt: '2026-01-01T00:00:00Z',
  sharedAt: null,
  signedAt: null,
  terminatedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('supabaseContractRepository.listByRelationship', () => {
  it('queries contracts scoped by rental_relationship_id, ordered by version_number descending, and maps rows', async () => {
    order.mockResolvedValueOnce({ data: [CONTRACT_ROW], error: null })

    const result = await supabaseContractRepository.listByRelationship('rel-1')

    expect(from).toHaveBeenCalledWith('contracts')
    expect(selectEq).toHaveBeenCalledWith('rental_relationship_id', 'rel-1')
    expect(order).toHaveBeenCalledWith('version_number', { ascending: false })
    expect(result).toEqual([CONTRACT_DOMAIN])
  })

  it('wraps a Supabase failure in ContractRepositoryError with code unknown', async () => {
    order.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    const error = await supabaseContractRepository.listByRelationship('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ContractRepositoryError)
    expect((error as ContractRepositoryError).code).toBe('unknown')
  })
})

const REGISTER_HABITEX_INPUT: RegisterHabitexGeneratedContractInput = {
  administrationId: 'admin-1',
  rentalRelationshipId: 'rel-1',
  documentFileId: 'file-1',
  documentHash: 'a'.repeat(64),
  termsSnapshot: TERMS_SNAPSHOT,
}

describe('supabaseContractRepository.registerHabitexGenerated', () => {
  it('calls register_habitex_generated_contract with the exact snake_case args (no p_administration_id)', async () => {
    rpc.mockResolvedValueOnce({ data: CONTRACT_ROW, error: null })

    const result = await supabaseContractRepository.registerHabitexGenerated(REGISTER_HABITEX_INPUT)

    expect(rpc).toHaveBeenCalledWith('register_habitex_generated_contract', {
      p_relationship_id: 'rel-1',
      p_document_file_id: 'file-1',
      p_document_hash: 'a'.repeat(64),
      p_terms_snapshot: TERMS_SNAPSHOT,
    })
    expect(result).toEqual(CONTRACT_DOMAIN)
  })

  it('handles the RPC returning a one-element array instead of a single object', async () => {
    rpc.mockResolvedValueOnce({ data: [CONTRACT_ROW], error: null })

    const result = await supabaseContractRepository.registerHabitexGenerated(REGISTER_HABITEX_INPUT)

    expect(result).toEqual(CONTRACT_DOMAIN)
  })

  it('never calls .from() - the RPC is the only creation path, never a raw INSERT', async () => {
    rpc.mockResolvedValueOnce({ data: CONTRACT_ROW, error: null })
    from.mockClear()

    await supabaseContractRepository.registerHabitexGenerated(REGISTER_HABITEX_INPUT)

    expect(from).not.toHaveBeenCalled()
  })

  it('maps MANAGEMENT_ACCESS_REQUIRED to code management_access_required', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'MANAGEMENT_ACCESS_REQUIRED' } })

    const error = await supabaseContractRepository
      .registerHabitexGenerated(REGISTER_HABITEX_INPUT)
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ContractRepositoryError)
    expect((error as ContractRepositoryError).code).toBe('management_access_required')
  })

  it('maps RENTAL_NOT_FOUND, DOCUMENT_FILE_NOT_FOUND to code not_found', async () => {
    for (const message of ['RENTAL_NOT_FOUND', 'DOCUMENT_FILE_NOT_FOUND']) {
      rpc.mockResolvedValueOnce({ data: null, error: { message } })

      const error = await supabaseContractRepository
        .registerHabitexGenerated(REGISTER_HABITEX_INPUT)
        .catch((e: unknown) => e)

      expect((error as ContractRepositoryError).code).toBe('not_found')
    }
  })

  it('maps INVALID_DOCUMENT_HASH to code invalid_document_hash', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'INVALID_DOCUMENT_HASH' } })

    const error = await supabaseContractRepository
      .registerHabitexGenerated(REGISTER_HABITEX_INPUT)
      .catch((e: unknown) => e)

    expect((error as ContractRepositoryError).code).toBe('invalid_document_hash')
  })

  it('maps a Postgres 23505 unique_violation to code version_conflict, by error code not message', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })

    const error = await supabaseContractRepository
      .registerHabitexGenerated(REGISTER_HABITEX_INPUT)
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ContractRepositoryError)
    expect((error as ContractRepositoryError).code).toBe('version_conflict')
  })

  it('maps an unrecognized exception to code unknown', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'SOMETHING_ELSE' } })

    const error = await supabaseContractRepository
      .registerHabitexGenerated(REGISTER_HABITEX_INPUT)
      .catch((e: unknown) => e)

    expect((error as ContractRepositoryError).code).toBe('unknown')
  })

  it('throws ContractRepositoryError if the RPC returns no row at all', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })

    await expect(supabaseContractRepository.registerHabitexGenerated(REGISTER_HABITEX_INPUT)).rejects.toBeInstanceOf(
      ContractRepositoryError,
    )
  })
})

const REGISTER_EXTERNAL_INPUT: RegisterExternalSignedContractInput = {
  administrationId: 'admin-1',
  rentalRelationshipId: 'rel-1',
  signedFileId: 'file-2',
  termsSnapshot: TERMS_SNAPSHOT,
}

const SIGNED_EXTERNAL_ROW = { ...CONTRACT_ROW, origin: 'EXTERNAL' as const, status: 'SIGNED' as const }

describe('supabaseContractRepository.registerExternalSigned', () => {
  it('calls register_external_signed_contract with the exact snake_case args', async () => {
    rpc.mockResolvedValueOnce({ data: SIGNED_EXTERNAL_ROW, error: null })

    await supabaseContractRepository.registerExternalSigned(REGISTER_EXTERNAL_INPUT)

    expect(rpc).toHaveBeenCalledWith('register_external_signed_contract', {
      p_relationship_id: 'rel-1',
      p_signed_file_id: 'file-2',
      p_terms_snapshot: TERMS_SNAPSHOT,
    })
  })

  it('maps SIGNED_FILE_NOT_FOUND to code not_found', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'SIGNED_FILE_NOT_FOUND' } })

    const error = await supabaseContractRepository
      .registerExternalSigned(REGISTER_EXTERNAL_INPUT)
      .catch((e: unknown) => e)

    expect((error as ContractRepositoryError).code).toBe('not_found')
  })

  it('maps a Postgres 23505 unique_violation to code version_conflict', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate key value' } })

    const error = await supabaseContractRepository
      .registerExternalSigned(REGISTER_EXTERNAL_INPUT)
      .catch((e: unknown) => e)

    expect((error as ContractRepositoryError).code).toBe('version_conflict')
  })

  it('never calls .from() - the RPC is the only creation path', async () => {
    rpc.mockResolvedValueOnce({ data: SIGNED_EXTERNAL_ROW, error: null })
    from.mockClear()

    await supabaseContractRepository.registerExternalSigned(REGISTER_EXTERNAL_INPUT)

    expect(from).not.toHaveBeenCalled()
  })
})

describe('supabaseContractRepository.attachSignedCopy', () => {
  it('calls attach_signed_contract_copy with p_contract_id/p_signed_file_id and maps the returned row', async () => {
    const row = { ...CONTRACT_ROW, status: 'SIGNED' as const, signed_file_id: 'file-3' }
    rpc.mockResolvedValueOnce({ data: row, error: null })

    const result = await supabaseContractRepository.attachSignedCopy('contract-1', 'file-3')

    expect(rpc).toHaveBeenCalledWith('attach_signed_contract_copy', {
      p_contract_id: 'contract-1',
      p_signed_file_id: 'file-3',
    })
    expect(result.status).toBe('SIGNED')
    expect(result.signedFileId).toBe('file-3')
  })

  it('maps CONTRACT_NOT_SIGNABLE to code not_signable', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'CONTRACT_NOT_SIGNABLE' } })

    const error = await supabaseContractRepository.attachSignedCopy('contract-1', 'file-3').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ContractRepositoryError)
    expect((error as ContractRepositoryError).code).toBe('not_signable')
  })

  it('maps CONTRACT_NOT_FOUND to code not_found', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'CONTRACT_NOT_FOUND' } })

    const error = await supabaseContractRepository.attachSignedCopy('contract-1', 'file-3').catch((e: unknown) => e)

    expect((error as ContractRepositoryError).code).toBe('not_found')
  })

  it('never calls .from()', async () => {
    rpc.mockResolvedValueOnce({ data: CONTRACT_ROW, error: null })
    from.mockClear()

    await supabaseContractRepository.attachSignedCopy('contract-1', 'file-3')

    expect(from).not.toHaveBeenCalled()
  })
})

describe('supabaseContractRepository.markShared', () => {
  it('issues a direct UPDATE guarded by both id and status=GENERATED, and maps the returned row', async () => {
    const row = { ...CONTRACT_ROW, status: 'SHARED' as const, shared_at: '2026-02-01T00:00:00Z' }
    single.mockResolvedValueOnce({ data: row, error: null })

    const result = await supabaseContractRepository.markShared('contract-1')

    expect(from).toHaveBeenCalledWith('contracts')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'SHARED' }))
    expect(updateEqId).toHaveBeenCalledWith('id', 'contract-1')
    expect(updateEqStatus).toHaveBeenCalledWith('status', 'GENERATED')
    expect(result.status).toBe('SHARED')
  })

  it('never calls .rpc() - this is a direct UPDATE, no RPC exists for this transition', async () => {
    single.mockResolvedValueOnce({ data: CONTRACT_ROW, error: null })
    rpc.mockClear()

    await supabaseContractRepository.markShared('contract-1')

    expect(rpc).not.toHaveBeenCalled()
  })

  it('surfaces a zero-rows-matched race (single() error) as a distinct ContractRepositoryError, not a silent success', async () => {
    single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
    })

    const error = await supabaseContractRepository.markShared('contract-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ContractRepositoryError)
    expect((error as ContractRepositoryError).code).toBe('unknown')
  })
})

describe('supabaseContractRepository.terminate', () => {
  it('issues a direct UPDATE guarded by both id and status=SIGNED, and maps the returned row', async () => {
    const row = { ...CONTRACT_ROW, status: 'TERMINATED' as const, terminated_at: '2026-03-01T00:00:00Z' }
    single.mockResolvedValueOnce({ data: row, error: null })

    const result = await supabaseContractRepository.terminate('contract-1')

    expect(from).toHaveBeenCalledWith('contracts')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'TERMINATED' }))
    expect(updateEqId).toHaveBeenCalledWith('id', 'contract-1')
    expect(updateEqStatus).toHaveBeenCalledWith('status', 'SIGNED')
    expect(result.status).toBe('TERMINATED')
  })

  it('never calls .rpc() - this is a direct UPDATE, no RPC exists for this transition', async () => {
    single.mockResolvedValueOnce({ data: CONTRACT_ROW, error: null })
    rpc.mockClear()

    await supabaseContractRepository.terminate('contract-1')

    expect(rpc).not.toHaveBeenCalled()
  })

  it('surfaces a zero-rows-matched race as a distinct ContractRepositoryError, not a silent success', async () => {
    single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
    })

    const error = await supabaseContractRepository.terminate('contract-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ContractRepositoryError)
    expect((error as ContractRepositoryError).code).toBe('unknown')
  })
})
