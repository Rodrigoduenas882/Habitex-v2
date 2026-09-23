import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { RentalLifecycleError, type RentalRelationship } from '../domain/rental.types'
import { rentalQueryKeys } from './rental-query-keys'
import { useEndRental } from './useEndRental'

const { end } = vi.hoisted(() => ({ end: vi.fn() }))

vi.mock('../infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: {
    end,
    activate: vi.fn(),
    cancelDraft: vi.fn(),
    createDraft: vi.fn(),
    listByAdministration: vi.fn(),
    startEnding: vi.fn(),
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

const ENDED: RentalRelationship = {
  id: 'rel-1',
  administrationId: 'admin-1',
  status: 'ENDED',
  jurisdictionCountry: 'CO',
  realStartDate: '2026-01-01',
  trackingStartDate: '2026-01-01',
  expectedEndDate: null,
  actualEndDate: '2026-09-23',
  paymentDay: 5,
  paymentTiming: 'ADVANCE',
}

describe('useEndRental', () => {
  it('calls the repository through the port with only the relationshipId, exactly once - no date argument', async () => {
    end.mockResolvedValueOnce(ENDED)
    const { result } = renderHook(() => useEndRental(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ administrationId: 'admin-1', relationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(end).toHaveBeenCalledTimes(1)
    expect(end).toHaveBeenCalledWith('rel-1')
    expect(result.current.data).toEqual(ENDED)
  })

  it('invalidates ["administration", administrationId, "rentals"] for that administration on success', async () => {
    end.mockResolvedValueOnce(ENDED)
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useEndRental(), { wrapper: wrapperFor(client) })

    result.current.mutate({ administrationId: 'admin-1', relationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: rentalQueryKeys.list('admin-1') })
  })

  it('surfaces a repository failure as a mutation error without swallowing its typed code', async () => {
    end.mockRejectedValueOnce(new RentalLifecycleError('not_endable'))
    const { result } = renderHook(() => useEndRental(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ administrationId: 'admin-1', relationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as RentalLifecycleError).code).toBe('not_endable')
  })
})
