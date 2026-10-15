import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { RentalLifecycleError, type RentalRelationship } from '../domain/rental.types'
import { rentalQueryKeys } from './rental-query-keys'
import { useStartEndingRental } from './useStartEndingRental'

const { startEnding } = vi.hoisted(() => ({ startEnding: vi.fn() }))

vi.mock('../infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: {
    startEnding,
    activate: vi.fn(),
    cancelDraft: vi.fn(),
    createDraft: vi.fn(),
    listByAdministration: vi.fn(),
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

const ENDING: RentalRelationship = {
  id: 'rel-1',
  administrationId: 'admin-1',
  status: 'ENDING',
  jurisdictionCountry: 'CO',
  realStartDate: '2026-01-01',
  trackingStartDate: '2026-01-01',
  expectedEndDate: null,
  actualEndDate: null,
  paymentDay: 5,
  paymentTiming: 'ADVANCE',
}

describe('useStartEndingRental', () => {
  it('calls the repository through the port with the relationshipId, exactly once', async () => {
    startEnding.mockResolvedValueOnce(ENDING)
    const { result } = renderHook(() => useStartEndingRental(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ administrationId: 'admin-1', relationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(startEnding).toHaveBeenCalledTimes(1)
    expect(startEnding).toHaveBeenCalledWith('rel-1')
    expect(result.current.data).toEqual(ENDING)
  })

  it('invalidates ["administration", administrationId, "rentals"] for that administration on success', async () => {
    startEnding.mockResolvedValueOnce(ENDING)
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useStartEndingRental(), { wrapper: wrapperFor(client) })

    result.current.mutate({ administrationId: 'admin-1', relationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: rentalQueryKeys.list('admin-1') })
  })

  it('surfaces a repository failure as a mutation error without swallowing its typed code', async () => {
    startEnding.mockRejectedValueOnce(new RentalLifecycleError('not_active'))
    const { result } = renderHook(() => useStartEndingRental(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ administrationId: 'admin-1', relationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as RentalLifecycleError).code).toBe('not_active')
  })
})
