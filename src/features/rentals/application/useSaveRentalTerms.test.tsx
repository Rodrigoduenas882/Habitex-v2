import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { RentalRepositoryError, type RentalRelationship } from '../domain/rental.types'
import type { RentalTermVersion } from '../domain/rental-terms.types'
import { rentalQueryKeys } from './rental-query-keys'
import { SaveRentalTermsError, useSaveRentalTerms, type SaveRentalTermsInput } from './useSaveRentalTerms'

const { updateSchedule } = vi.hoisted(() => ({ updateSchedule: vi.fn() }))
const { create } = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('../infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: {
    listByAdministration: vi.fn(),
    createDraft: vi.fn(),
    activate: vi.fn(),
    updateSchedule,
  },
}))

vi.mock('../infrastructure/supabase-rental-terms.repository', () => ({
  supabaseRentalTermsRepository: { create, getCurrent: vi.fn() },
}))

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

const UPDATED_RELATIONSHIP: RentalRelationship = {
  id: 'rel-1',
  administrationId: 'admin-1',
  status: 'DRAFT',
  jurisdictionCountry: 'CO',
  realStartDate: '2026-01-01',
  trackingStartDate: '2026-01-01',
  expectedEndDate: null,
  actualEndDate: null,
  paymentDay: 5,
  paymentTiming: 'ADVANCE',
}

const TERM_VERSION: RentalTermVersion = {
  id: 'term-1',
  rentalRelationshipId: 'rel-1',
  versionNumber: 1,
  effectiveFrom: '2026-01-01',
  effectiveUntil: null,
  rentAmount: 1000000,
  administrationMode: 'NONE',
  utilitiesMode: null,
  createdAt: '2026-01-01T00:00:00Z',
}

const INPUT: SaveRentalTermsInput = {
  administrationId: 'admin-1',
  relationshipId: 'rel-1',
  realStartDate: '2026-01-01',
  trackingStartDate: '2026-01-01',
  paymentDay: 5,
  paymentTiming: 'ADVANCE',
  expectedEndDate: null,
  rentAmount: 1000000,
  administrationMode: 'NONE',
  utilitiesMode: null,
}

describe('useSaveRentalTerms', () => {
  it('calls updateSchedule then rentalTermsRepository.create, in that order, with realStartDate reused as effectiveFrom', async () => {
    const calls: string[] = []
    updateSchedule.mockImplementationOnce(() => {
      calls.push('updateSchedule')
      return Promise.resolve(UPDATED_RELATIONSHIP)
    })
    create.mockImplementationOnce(() => {
      calls.push('create')
      return Promise.resolve(TERM_VERSION)
    })

    const { result } = renderHook(() => useSaveRentalTerms(), { wrapper: wrapperFor(createClient()) })
    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(calls).toEqual(['updateSchedule', 'create'])
    expect(updateSchedule).toHaveBeenCalledWith('rel-1', {
      realStartDate: '2026-01-01',
      trackingStartDate: '2026-01-01',
      paymentDay: 5,
      paymentTiming: 'ADVANCE',
      expectedEndDate: null,
    })
    expect(create).toHaveBeenCalledWith({
      rentalRelationshipId: 'rel-1',
      effectiveFrom: '2026-01-01',
      rentAmount: 1000000,
      administrationMode: 'NONE',
      utilitiesMode: null,
    })
  })

  it('invalidates the terms query key and the rentals list for that administration on success', async () => {
    updateSchedule.mockResolvedValueOnce(UPDATED_RELATIONSHIP)
    create.mockResolvedValueOnce(TERM_VERSION)
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useSaveRentalTerms(), { wrapper: wrapperFor(client) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: rentalQueryKeys.terms('admin-1', 'rel-1') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: rentalQueryKeys.list('admin-1') })
  })

  it('propagates the raw error and never calls create when updateSchedule itself fails - nothing was saved', async () => {
    updateSchedule.mockRejectedValueOnce(new RentalRepositoryError('boom'))
    const { result } = renderHook(() => useSaveRentalTerms(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toBeInstanceOf(RentalRepositoryError)
    expect(result.current.error).not.toBeInstanceOf(SaveRentalTermsError)
    expect(create).not.toHaveBeenCalled()
  })

  it('wraps a create failure in SaveRentalTermsError once updateSchedule already succeeded - schedule was saved', async () => {
    updateSchedule.mockResolvedValueOnce(UPDATED_RELATIONSHIP)
    create.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useSaveRentalTerms(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toBeInstanceOf(SaveRentalTermsError)
  })
})
