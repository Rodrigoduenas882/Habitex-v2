import { describe, expect, it, vi } from 'vitest'
import { RentalTermsRepositoryError, type CreateRentalTermVersionInput } from '../domain/rental-terms.types'

const { eq, order, limit, maybeSingle, insert, single, from } = vi.hoisted(() => {
  const maybeSingle = vi.fn()
  const limit = vi.fn(() => ({ maybeSingle }))
  const order = vi.fn(() => ({ limit }))
  const single = vi.fn()
  const insertSelect = vi.fn(() => ({ single }))
  const eq = vi.fn((_column: string, _value: string) => ({ order }))
  const insert = vi.fn(() => ({ select: insertSelect }))
  const select = vi.fn((_columns: string) => ({ eq }))
  const from = vi.fn((_table: string) => ({ select, insert }))
  return { eq, order, limit, maybeSingle, select, insert, single, from }
})

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: { from },
}))

import { supabaseRentalTermsRepository } from './supabase-rental-terms.repository'

const ROW = {
  id: 'term-1',
  rental_relationship_id: 'rel-1',
  version_number: 1,
  effective_from: '2026-01-01',
  effective_until: null,
  rent_amount: 1000000,
  administration_mode: 'NONE',
  utilities_mode: null,
  created_at: '2026-01-01T00:00:00Z',
}

const CREATE_INPUT: CreateRentalTermVersionInput = {
  rentalRelationshipId: 'rel-1',
  effectiveFrom: '2026-01-01',
  rentAmount: 1000000,
  administrationMode: 'NONE',
  utilitiesMode: null,
}

describe('supabaseRentalTermsRepository.create', () => {
  it('inserts into rental_term_versions with version_number 1 and effective_until null, and maps the row back', async () => {
    single.mockResolvedValueOnce({ data: ROW, error: null })

    const result = await supabaseRentalTermsRepository.create(CREATE_INPUT)

    expect(from).toHaveBeenCalledWith('rental_term_versions')
    expect(insert).toHaveBeenCalledWith({
      rental_relationship_id: 'rel-1',
      version_number: 1,
      effective_from: '2026-01-01',
      effective_until: null,
      rent_amount: 1000000,
      administration_mode: 'NONE',
      utilities_mode: null,
    })
    expect(result).toEqual({
      id: 'term-1',
      rentalRelationshipId: 'rel-1',
      versionNumber: 1,
      effectiveFrom: '2026-01-01',
      effectiveUntil: null,
      rentAmount: 1000000,
      administrationMode: 'NONE',
      utilitiesMode: null,
      createdAt: '2026-01-01T00:00:00Z',
    })
  })

  it('wraps a Supabase failure in RentalTermsRepositoryError instead of throwing the raw error', async () => {
    single.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(supabaseRentalTermsRepository.create(CREATE_INPUT)).rejects.toBeInstanceOf(
      RentalTermsRepositoryError,
    )
  })
})

describe('supabaseRentalTermsRepository.getCurrent', () => {
  it('queries rental_term_versions scoped by rental_relationship_id, ordered by version_number descending, limit 1', async () => {
    maybeSingle.mockResolvedValueOnce({ data: ROW, error: null })

    const result = await supabaseRentalTermsRepository.getCurrent('rel-1')

    expect(from).toHaveBeenCalledWith('rental_term_versions')
    expect(eq).toHaveBeenCalledWith('rental_relationship_id', 'rel-1')
    expect(order).toHaveBeenCalledWith('version_number', { ascending: false })
    expect(limit).toHaveBeenCalledWith(1)
    expect(result).toEqual({
      id: 'term-1',
      rentalRelationshipId: 'rel-1',
      versionNumber: 1,
      effectiveFrom: '2026-01-01',
      effectiveUntil: null,
      rentAmount: 1000000,
      administrationMode: 'NONE',
      utilitiesMode: null,
      createdAt: '2026-01-01T00:00:00Z',
    })
  })

  it('returns null without error when no term version exists yet', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await supabaseRentalTermsRepository.getCurrent('rel-1')

    expect(result).toBeNull()
  })

  it('wraps a Supabase failure in RentalTermsRepositoryError instead of throwing the raw error', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(supabaseRentalTermsRepository.getCurrent('rel-1')).rejects.toBeInstanceOf(
      RentalTermsRepositoryError,
    )
  })
})
