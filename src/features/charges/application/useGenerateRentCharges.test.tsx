import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ChargeRepositoryError } from '../domain/charge.types'
import { chargeQueryKeys } from './charge-query-keys'
import { useGenerateRentCharges } from './useGenerateRentCharges'

const { generateRentCharges } = vi.hoisted(() => ({ generateRentCharges: vi.fn() }))

vi.mock('../infrastructure/supabase-charge.repository', () => ({
  supabaseChargeRepository: {
    listByRelationship: vi.fn(),
    generateRentCharges,
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

describe('useGenerateRentCharges', () => {
  it('calls the repository through the port with only the relationshipId, exactly once', async () => {
    generateRentCharges.mockResolvedValueOnce({ createdCount: 3 })
    const { result } = renderHook(() => useGenerateRentCharges(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ administrationId: 'admin-1', rentalRelationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(generateRentCharges).toHaveBeenCalledTimes(1)
    expect(generateRentCharges).toHaveBeenCalledWith('rel-1')
    expect(result.current.data).toEqual({ createdCount: 3 })
  })

  it('invalidates this relationship\'s charges list on success', async () => {
    generateRentCharges.mockResolvedValueOnce({ createdCount: 0 })
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useGenerateRentCharges(), { wrapper: wrapperFor(client) })

    result.current.mutate({ administrationId: 'admin-1', rentalRelationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chargeQueryKeys.list('admin-1', 'rel-1') })
  })

  it('treats createdCount: 0 as a successful mutation outcome, not an error', async () => {
    generateRentCharges.mockResolvedValueOnce({ createdCount: 0 })
    const { result } = renderHook(() => useGenerateRentCharges(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ administrationId: 'admin-1', rentalRelationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toEqual({ createdCount: 0 })
  })

  it('surfaces a repository failure as a mutation error without swallowing its typed code', async () => {
    generateRentCharges.mockRejectedValueOnce(new ChargeRepositoryError('not_chargeable'))
    const { result } = renderHook(() => useGenerateRentCharges(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ administrationId: 'admin-1', rentalRelationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as ChargeRepositoryError).code).toBe('not_chargeable')
  })
})
