import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { RentalLifecycleError, type RentalRelationship } from '../domain/rental.types'
import { rentalQueryKeys } from './rental-query-keys'
import { useCancelDraftRental } from './useCancelDraftRental'

const { cancelDraft } = vi.hoisted(() => ({ cancelDraft: vi.fn() }))

vi.mock('../infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: {
    cancelDraft,
    activate: vi.fn(),
    createDraft: vi.fn(),
    listByAdministration: vi.fn(),
    startEnding: vi.fn(),
    end: vi.fn(),
    updateSchedule: vi.fn(),
  },
}))

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

const CANCELLED: RentalRelationship = {
  id: 'rel-1',
  administrationId: 'admin-1',
  status: 'CANCELLED',
  jurisdictionCountry: 'CO',
  realStartDate: null,
  trackingStartDate: null,
  expectedEndDate: null,
  actualEndDate: null,
  paymentDay: null,
  paymentTiming: null,
}

describe('useCancelDraftRental', () => {
  it('calls the repository through the port with the relationshipId, exactly once', async () => {
    cancelDraft.mockResolvedValueOnce(CANCELLED)
    const { result } = renderHook(() => useCancelDraftRental(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ administrationId: 'admin-1', relationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(cancelDraft).toHaveBeenCalledTimes(1)
    expect(cancelDraft).toHaveBeenCalledWith('rel-1')
    expect(result.current.data).toEqual(CANCELLED)
  })

  it('invalidates ["administration", administrationId, "rentals"] for that administration on success', async () => {
    cancelDraft.mockResolvedValueOnce(CANCELLED)
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCancelDraftRental(), { wrapper: wrapperFor(client) })

    result.current.mutate({ administrationId: 'admin-1', relationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: rentalQueryKeys.list('admin-1') })
  })

  it('surfaces a repository failure as a mutation error without swallowing its typed code', async () => {
    cancelDraft.mockRejectedValueOnce(new RentalLifecycleError('not_draft'))
    const { result } = renderHook(() => useCancelDraftRental(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ administrationId: 'admin-1', relationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as RentalLifecycleError).code).toBe('not_draft')
  })
})
