import { describe, expect, it, vi } from 'vitest'
import {
  RentalActivationError,
  RentalLifecycleError,
  RentalRepositoryError,
  type CreateRentalDraftInput,
  type RentalScheduleInput,
} from '../domain/rental.types'

const { eq, order, select, updateSingle, update, from, rpc } = vi.hoisted(() => {
  const order = vi.fn()
  const eq = vi.fn((_column: string, _value: string) => ({ order }))
  const select = vi.fn((_columns: string) => ({ eq }))
  const updateSingle = vi.fn()
  const updateSelect = vi.fn((_columns: string) => ({ single: updateSingle }))
  const updateEq = vi.fn((_column: string, _value: string) => ({ select: updateSelect }))
  const update = vi.fn((_values: Record<string, unknown>) => ({ eq: updateEq }))
  const from = vi.fn((_table: string) => ({ select, update }))
  const rpc = vi.fn()
  return { eq, order, select, updateSingle, update, from, rpc }
})

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: { from, rpc },
}))

import { supabaseRentalRepository } from './supabase-rental.repository'

const ALL_STATUSES = ['DRAFT', 'ACTIVE', 'ENDING', 'ENDED', 'CANCELLED'] as const

describe('supabaseRentalRepository.listByAdministration', () => {
  it('queries rental_relationships scoped by administration_id and maps snake_case rows to the domain shape', async () => {
    order.mockResolvedValueOnce({
      data: [
        {
          id: 'rental-1',
          administration_id: 'admin-1',
          status: 'ACTIVE',
          jurisdiction_country: 'CO',
          real_start_date: '2026-01-01',
          tracking_start_date: '2026-09-18',
          expected_end_date: '2027-01-01',
          actual_end_date: null,
          payment_day: 5,
          payment_timing: 'ADVANCE',
        },
      ],
      error: null,
    })

    const result = await supabaseRentalRepository.listByAdministration('admin-1')

    expect(from).toHaveBeenCalledWith('rental_relationships')
    expect(eq).toHaveBeenCalledWith('administration_id', 'admin-1')
    expect(result).toEqual([
      {
        id: 'rental-1',
        administrationId: 'admin-1',
        status: 'ACTIVE',
        jurisdictionCountry: 'CO',
        realStartDate: '2026-01-01',
        trackingStartDate: '2026-09-18',
        expectedEndDate: '2027-01-01',
        actualEndDate: null,
        paymentDay: 5,
        paymentTiming: 'ADVANCE',
      },
    ])
  })

  it('never selects every column with *, and never selects rental_subjects/participants/terms columns', () => {
    for (const [columns] of select.mock.calls) {
      expect(columns).not.toBe('*')
      expect(columns).not.toContain('*')
      expect(columns).not.toContain('rental_subject')
      expect(columns).not.toContain('participant')
      expect(columns).not.toContain('term')
    }
  })

  it('never queries a different table (no accidental joins to rental_subjects/participants/terms)', () => {
    for (const [table] of from.mock.calls) {
      expect(table).toBe('rental_relationships')
    }
  })

  it('preserves all nullable date/payment fields exactly as null, without inventing values', async () => {
    order.mockResolvedValueOnce({
      data: [
        {
          id: 'rental-2',
          administration_id: 'admin-1',
          status: 'DRAFT',
          jurisdiction_country: 'CO',
          real_start_date: null,
          tracking_start_date: null,
          expected_end_date: null,
          actual_end_date: null,
          payment_day: null,
          payment_timing: null,
        },
      ],
      error: null,
    })

    const result = await supabaseRentalRepository.listByAdministration('admin-1')

    expect(result).toEqual([
      {
        id: 'rental-2',
        administrationId: 'admin-1',
        status: 'DRAFT',
        jurisdictionCountry: 'CO',
        realStartDate: null,
        trackingStartDate: null,
        expectedEndDate: null,
        actualEndDate: null,
        paymentDay: null,
        paymentTiming: null,
      },
    ])
  })

  it('maps rows through unchanged for every real RentalStatus value', async () => {
    for (const status of ALL_STATUSES) {
      order.mockResolvedValueOnce({
        data: [
          {
            id: 'rental-3',
            administration_id: 'admin-1',
            status,
            jurisdiction_country: 'CO',
            real_start_date: null,
            tracking_start_date: null,
            expected_end_date: null,
            actual_end_date: null,
            payment_day: null,
            payment_timing: null,
          },
        ],
        error: null,
      })

      const result = await supabaseRentalRepository.listByAdministration('admin-1')

      expect(result[0]?.status).toBe(status)
    }
  })

  it('wraps a Supabase failure in RentalRepositoryError instead of throwing the raw error', async () => {
    order.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(supabaseRentalRepository.listByAdministration('admin-1')).rejects.toBeInstanceOf(
      RentalRepositoryError,
    )
  })
})

const EXISTING_TENANT_INPUT: CreateRentalDraftInput = {
  administrationId: 'admin-1',
  rentalSubjectId: 'subj-1',
  tenant: { kind: 'existing', personId: 'person-1' },
}

const NEW_TENANT_INPUT: CreateRentalDraftInput = {
  administrationId: 'admin-1',
  rentalSubjectId: 'subj-1',
  tenant: {
    kind: 'new',
    fullName: 'Nueva Persona',
    documentType: 'CC',
    documentNumber: '123',
    documentCountry: 'CO',
    nationalityCountry: 'CO',
    email: 'nueva@example.com',
    phone: '3001234567',
  },
}

describe('supabaseRentalRepository.createDraft', () => {
  it('calls create_rental_draft with p_tenant_person_id set and every p_tenant_* new-tenant field null, for an existing tenant', async () => {
    rpc.mockResolvedValueOnce({
      data: [{ rental_relationship_id: 'rel-1', tenant_person_id: 'person-1' }],
      error: null,
    })

    const result = await supabaseRentalRepository.createDraft(EXISTING_TENANT_INPUT)

    expect(rpc).toHaveBeenCalledWith('create_rental_draft', {
      p_administration_id: 'admin-1',
      p_rental_subject_id: 'subj-1',
      p_tenant_person_id: 'person-1',
      p_tenant_full_name: null,
      p_tenant_document_type: null,
      p_tenant_document_number: null,
      p_tenant_document_country: null,
      p_tenant_nationality_country: null,
      p_tenant_email: null,
      p_tenant_phone: null,
    })
    expect(result).toEqual({ rentalRelationshipId: 'rel-1', tenantPersonId: 'person-1' })
  })

  it('calls create_rental_draft with p_tenant_person_id null and the real new-tenant fields, for a new tenant', async () => {
    rpc.mockResolvedValueOnce({
      data: [{ rental_relationship_id: 'rel-2', tenant_person_id: 'person-2' }],
      error: null,
    })

    await supabaseRentalRepository.createDraft(NEW_TENANT_INPUT)

    expect(rpc).toHaveBeenCalledWith('create_rental_draft', {
      p_administration_id: 'admin-1',
      p_rental_subject_id: 'subj-1',
      p_tenant_person_id: null,
      p_tenant_full_name: 'Nueva Persona',
      p_tenant_document_type: 'CC',
      p_tenant_document_number: '123',
      p_tenant_document_country: 'CO',
      p_tenant_nationality_country: 'CO',
      p_tenant_email: 'nueva@example.com',
      p_tenant_phone: '3001234567',
    })
  })

  it('handles the RPC returning a single object instead of a one-element array', async () => {
    rpc.mockResolvedValueOnce({
      data: { rental_relationship_id: 'rel-3', tenant_person_id: 'person-1' },
      error: null,
    })

    const result = await supabaseRentalRepository.createDraft(EXISTING_TENANT_INPUT)

    expect(result).toEqual({ rentalRelationshipId: 'rel-3', tenantPersonId: 'person-1' })
  })

  it('wraps a Supabase RPC failure in RentalRepositoryError instead of throwing the raw error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(supabaseRentalRepository.createDraft(EXISTING_TENANT_INPUT)).rejects.toBeInstanceOf(
      RentalRepositoryError,
    )
  })

  it('throws RentalRepositoryError if the RPC returns no row at all', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null })

    await expect(supabaseRentalRepository.createDraft(EXISTING_TENANT_INPUT)).rejects.toBeInstanceOf(
      RentalRepositoryError,
    )
  })

  it('never calls .from() (create_rental_draft is the only write path, no direct insert)', async () => {
    rpc.mockResolvedValueOnce({
      data: [{ rental_relationship_id: 'rel-1', tenant_person_id: 'person-1' }],
      error: null,
    })
    from.mockClear()

    await supabaseRentalRepository.createDraft(EXISTING_TENANT_INPUT)

    expect(from).not.toHaveBeenCalled()
  })
})

const ACTIVATED_ROW = {
  id: 'rel-1',
  administration_id: 'admin-1',
  status: 'ACTIVE',
  jurisdiction_country: 'CO',
  real_start_date: '2026-01-01',
  tracking_start_date: '2026-01-01',
  expected_end_date: null,
  actual_end_date: null,
  payment_day: 5,
  payment_timing: 'ADVANCE',
}

describe('supabaseRentalRepository.activate', () => {
  it('calls activate_rental_relationship with p_relationship_id and maps the returned row to the domain shape', async () => {
    rpc.mockResolvedValueOnce({ data: ACTIVATED_ROW, error: null })

    const result = await supabaseRentalRepository.activate('rel-1')

    expect(rpc).toHaveBeenCalledWith('activate_rental_relationship', { p_relationship_id: 'rel-1' })
    expect(result).toEqual({
      id: 'rel-1',
      administrationId: 'admin-1',
      status: 'ACTIVE',
      jurisdictionCountry: 'CO',
      realStartDate: '2026-01-01',
      trackingStartDate: '2026-01-01',
      expectedEndDate: null,
      actualEndDate: null,
      paymentDay: 5,
      paymentTiming: 'ADVANCE',
    })
  })

  it('handles the RPC returning a one-element array instead of a single object', async () => {
    rpc.mockResolvedValueOnce({ data: [ACTIVATED_ROW], error: null })

    const result = await supabaseRentalRepository.activate('rel-1')

    expect(result.status).toBe('ACTIVE')
  })

  it('maps MANAGEMENT_ACCESS_REQUIRED to a RentalActivationError with code management_access_required', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'MANAGEMENT_ACCESS_REQUIRED' } })

    const error = await supabaseRentalRepository.activate('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RentalActivationError)
    expect((error as RentalActivationError).code).toBe('management_access_required')
  })

  it('maps RELATIONSHIP_CAPACITY_REACHED to a RentalActivationError with code capacity_reached', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'RELATIONSHIP_CAPACITY_REACHED' } })

    const error = await supabaseRentalRepository.activate('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RentalActivationError)
    expect((error as RentalActivationError).code).toBe('capacity_reached')
  })

  it('maps RENTAL_TERMS_INCOMPLETE to a RentalActivationError with code terms_incomplete', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'RENTAL_TERMS_INCOMPLETE' } })

    const error = await supabaseRentalRepository.activate('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RentalActivationError)
    expect((error as RentalActivationError).code).toBe('terms_incomplete')
  })

  it('maps INITIAL_TERM_VERSION_REQUIRED to the same terms_incomplete code as RENTAL_TERMS_INCOMPLETE', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'INITIAL_TERM_VERSION_REQUIRED' } })

    const error = await supabaseRentalRepository.activate('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RentalActivationError)
    expect((error as RentalActivationError).code).toBe('terms_incomplete')
  })

  it('maps RENTAL_NOT_DRAFT to a RentalActivationError with code already_active', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'RENTAL_NOT_DRAFT' } })

    const error = await supabaseRentalRepository.activate('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RentalActivationError)
    expect((error as RentalActivationError).code).toBe('already_active')
  })

  it('maps RENTAL_SUBJECT_ALREADY_IN_USE to a RentalActivationError with code subject_in_use', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'RENTAL_SUBJECT_ALREADY_IN_USE' } })

    const error = await supabaseRentalRepository.activate('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RentalActivationError)
    expect((error as RentalActivationError).code).toBe('subject_in_use')
  })

  it('maps every other/unrecognized exception (e.g. PRIMARY_SUBJECT_REQUIRED, deliberately unmapped) to code unknown', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'PRIMARY_SUBJECT_REQUIRED' } })

    const error = await supabaseRentalRepository.activate('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RentalActivationError)
    expect((error as RentalActivationError).code).toBe('unknown')
  })

  it('throws RentalRepositoryError if the RPC returns no row at all', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })

    await expect(supabaseRentalRepository.activate('rel-1')).rejects.toBeInstanceOf(RentalRepositoryError)
  })

  it('never calls .from() (activate_rental_relationship is the only write path, no direct update)', async () => {
    rpc.mockResolvedValueOnce({ data: ACTIVATED_ROW, error: null })
    from.mockClear()

    await supabaseRentalRepository.activate('rel-1')

    expect(from).not.toHaveBeenCalled()
  })
})

const SCHEDULE_INPUT: RentalScheduleInput = {
  realStartDate: '2026-01-01',
  trackingStartDate: '2026-01-01',
  paymentDay: 5,
  paymentTiming: 'ADVANCE',
  expectedEndDate: null,
}

describe('supabaseRentalRepository.updateSchedule', () => {
  it('issues a direct UPDATE on rental_relationships scoped by id, and maps the returned row to the domain shape', async () => {
    updateSingle.mockResolvedValueOnce({ data: ACTIVATED_ROW, error: null })

    const result = await supabaseRentalRepository.updateSchedule('rel-1', SCHEDULE_INPUT)

    expect(from).toHaveBeenCalledWith('rental_relationships')
    expect(update).toHaveBeenCalledWith({
      real_start_date: '2026-01-01',
      tracking_start_date: '2026-01-01',
      payment_day: 5,
      payment_timing: 'ADVANCE',
      expected_end_date: null,
    })
    expect(result).toEqual({
      id: 'rel-1',
      administrationId: 'admin-1',
      status: 'ACTIVE',
      jurisdictionCountry: 'CO',
      realStartDate: '2026-01-01',
      trackingStartDate: '2026-01-01',
      expectedEndDate: null,
      actualEndDate: null,
      paymentDay: 5,
      paymentTiming: 'ADVANCE',
    })
  })

  it('wraps a Supabase failure in RentalRepositoryError instead of throwing the raw error', async () => {
    updateSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(supabaseRentalRepository.updateSchedule('rel-1', SCHEDULE_INPUT)).rejects.toBeInstanceOf(
      RentalRepositoryError,
    )
  })

  it('never calls .rpc() (this is a direct UPDATE, not an RPC call)', async () => {
    updateSingle.mockResolvedValueOnce({ data: ACTIVATED_ROW, error: null })
    rpc.mockClear()

    await supabaseRentalRepository.updateSchedule('rel-1', SCHEDULE_INPUT)

    expect(rpc).not.toHaveBeenCalled()
  })
})

const CANCELLED_ROW = { ...ACTIVATED_ROW, status: 'CANCELLED' }
const ENDING_ROW = { ...ACTIVATED_ROW, status: 'ENDING' }
const ENDED_ROW = { ...ACTIVATED_ROW, status: 'ENDED' }

describe('supabaseRentalRepository.cancelDraft', () => {
  it('calls cancel_draft_rental with p_relationship_id and maps the returned row to the domain shape', async () => {
    rpc.mockResolvedValueOnce({ data: CANCELLED_ROW, error: null })

    const result = await supabaseRentalRepository.cancelDraft('rel-1')

    expect(rpc).toHaveBeenCalledWith('cancel_draft_rental', { p_relationship_id: 'rel-1' })
    expect(result.status).toBe('CANCELLED')
  })

  it('handles the RPC returning a one-element array instead of a single object', async () => {
    rpc.mockResolvedValueOnce({ data: [CANCELLED_ROW], error: null })

    const result = await supabaseRentalRepository.cancelDraft('rel-1')

    expect(result.status).toBe('CANCELLED')
  })

  it('maps MANAGEMENT_ACCESS_REQUIRED to a RentalLifecycleError with code management_access_required', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'MANAGEMENT_ACCESS_REQUIRED' } })

    const error = await supabaseRentalRepository.cancelDraft('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RentalLifecycleError)
    expect((error as RentalLifecycleError).code).toBe('management_access_required')
  })

  it('maps ONLY_DRAFT_CAN_BE_CANCELLED to a RentalLifecycleError with code not_draft', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'ONLY_DRAFT_CAN_BE_CANCELLED' } })

    const error = await supabaseRentalRepository.cancelDraft('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RentalLifecycleError)
    expect((error as RentalLifecycleError).code).toBe('not_draft')
  })

  it('maps an unrecognized exception (e.g. RENTAL_NOT_FOUND, deliberately unmapped) to code unknown', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'RENTAL_NOT_FOUND' } })

    const error = await supabaseRentalRepository.cancelDraft('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RentalLifecycleError)
    expect((error as RentalLifecycleError).code).toBe('unknown')
  })

  it('throws RentalRepositoryError if the RPC returns no row at all', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })

    await expect(supabaseRentalRepository.cancelDraft('rel-1')).rejects.toBeInstanceOf(RentalRepositoryError)
  })

  it('never calls .from() (cancel_draft_rental is the only write path, no direct update)', async () => {
    rpc.mockResolvedValueOnce({ data: CANCELLED_ROW, error: null })
    from.mockClear()

    await supabaseRentalRepository.cancelDraft('rel-1')

    expect(from).not.toHaveBeenCalled()
  })
})

describe('supabaseRentalRepository.startEnding', () => {
  it('calls start_ending_rental with p_relationship_id and maps the returned row to the domain shape', async () => {
    rpc.mockResolvedValueOnce({ data: ENDING_ROW, error: null })

    const result = await supabaseRentalRepository.startEnding('rel-1')

    expect(rpc).toHaveBeenCalledWith('start_ending_rental', { p_relationship_id: 'rel-1' })
    expect(result.status).toBe('ENDING')
  })

  it('maps RENTAL_NOT_ACTIVE to a RentalLifecycleError with code not_active', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'RENTAL_NOT_ACTIVE' } })

    const error = await supabaseRentalRepository.startEnding('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RentalLifecycleError)
    expect((error as RentalLifecycleError).code).toBe('not_active')
  })

  it('maps an unrecognized exception (e.g. ADMINISTRATION_ROLE_REQUIRED, deliberately unmapped) to code unknown', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'ADMINISTRATION_ROLE_REQUIRED' } })

    const error = await supabaseRentalRepository.startEnding('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RentalLifecycleError)
    expect((error as RentalLifecycleError).code).toBe('unknown')
  })

  it('throws RentalRepositoryError if the RPC returns no row at all', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })

    await expect(supabaseRentalRepository.startEnding('rel-1')).rejects.toBeInstanceOf(RentalRepositoryError)
  })

  it('never calls .from() (start_ending_rental is the only write path, no direct update)', async () => {
    rpc.mockResolvedValueOnce({ data: ENDING_ROW, error: null })
    from.mockClear()

    await supabaseRentalRepository.startEnding('rel-1')

    expect(from).not.toHaveBeenCalled()
  })
})

describe('supabaseRentalRepository.end', () => {
  it('calls end_rental with only p_relationship_id - never a p_actual_end_date key - and maps the returned row', async () => {
    rpc.mockResolvedValueOnce({ data: ENDED_ROW, error: null })

    const result = await supabaseRentalRepository.end('rel-1')

    expect(rpc).toHaveBeenCalledWith('end_rental', { p_relationship_id: 'rel-1' })
    const [, args] = rpc.mock.calls[rpc.mock.calls.length - 1] as [string, Record<string, unknown>]
    expect(Object.keys(args)).toEqual(['p_relationship_id'])
    expect(result.status).toBe('ENDED')
  })

  it('maps RENTAL_NOT_ENDABLE to a RentalLifecycleError with code not_endable', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'RENTAL_NOT_ENDABLE' } })

    const error = await supabaseRentalRepository.end('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RentalLifecycleError)
    expect((error as RentalLifecycleError).code).toBe('not_endable')
  })

  it('maps END_BEFORE_START to a RentalLifecycleError with code end_before_start', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'END_BEFORE_START' } })

    const error = await supabaseRentalRepository.end('rel-1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RentalLifecycleError)
    expect((error as RentalLifecycleError).code).toBe('end_before_start')
  })

  it('throws RentalRepositoryError if the RPC returns no row at all', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })

    await expect(supabaseRentalRepository.end('rel-1')).rejects.toBeInstanceOf(RentalRepositoryError)
  })

  it('never calls .from() (end_rental is the only write path, no direct update)', async () => {
    rpc.mockResolvedValueOnce({ data: ENDED_ROW, error: null })
    from.mockClear()

    await supabaseRentalRepository.end('rel-1')

    expect(from).not.toHaveBeenCalled()
  })
})
