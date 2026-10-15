import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { RentalActivationError, type RentalRelationship } from '../domain/rental.types'
import { rentalQueryKeys } from './rental-query-keys'
import { useActivateRental } from './useActivateRental'

const { activate } = vi.hoisted(() => ({ activate: vi.fn() }))

vi.mock('../infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: { activate, createDraft: vi.fn(), listByAdministration: vi.fn() },
}))

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

const ACTIVATED: RentalRelationship = {
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
}

describe('useActivateRental', () => {
  it('calls the repository through the port with the relationshipId, exactly once', async () => {
    activate.mockResolvedValueOnce(ACTIVATED)
    const { result } = renderHook(() => useActivateRental(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ administrationId: 'admin-1', relationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(activate).toHaveBeenCalledTimes(1)
    expect(activate).toHaveBeenCalledWith('rel-1')
    expect(result.current.data).toEqual(ACTIVATED)
  })

  it('invalidates ["administration", administrationId, "rentals"] for that administration on success', async () => {
    activate.mockResolvedValueOnce(ACTIVATED)
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useActivateRental(), { wrapper: wrapperFor(client) })

    result.current.mutate({ administrationId: 'admin-1', relationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: rentalQueryKeys.list('admin-1') })
  })

  it('surfaces a repository failure as a mutation error without swallowing its typed code', async () => {
    activate.mockRejectedValueOnce(new RentalActivationError('capacity_reached'))
    const { result } = renderHook(() => useActivateRental(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ administrationId: 'admin-1', relationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as RentalActivationError).code).toBe('capacity_reached')
  })
})
