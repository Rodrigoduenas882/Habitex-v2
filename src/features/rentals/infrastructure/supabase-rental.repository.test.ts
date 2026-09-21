import { describe, expect, it, vi } from 'vitest'
import { RentalRepositoryError, type CreateRentalDraftInput } from '../domain/rental.types'

const { eq, order, select, from, rpc } = vi.hoisted(() => {
  const order = vi.fn()
  const eq = vi.fn((_column: string, _value: string) => ({ order }))
  const select = vi.fn((_columns: string) => ({ eq }))
  const from = vi.fn((_table: string) => ({ select }))
  const rpc = vi.fn()
  return { eq, order, select, from, rpc }
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
