import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PropertyRepositoryError } from '../domain/property.types'
import { propertyQueryKeys } from './property-query-keys'
import { useCreateFullProperty } from './useCreateFullProperty'

const { createFullProperty } = vi.hoisted(() => ({ createFullProperty: vi.fn() }))

vi.mock('../infrastructure/supabase-property.repository', () => ({
  supabasePropertyRepository: { createFullProperty, createRoomRentalProperty: vi.fn(), listByAdministration: vi.fn() },
}))

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

const INPUT = {
  propertyType: 'APARTMENT' as const,
  name: 'Apartamento 302',
  city: 'Bogotá',
  address: 'Calle 1 # 2-3',
  countryCode: 'CO',
  hasAdministration: false,
  administrationFee: null,
}

describe('useCreateFullProperty', () => {
  it('calls the repository through the port with the administrationId merged in', async () => {
    createFullProperty.mockResolvedValueOnce(undefined)
    const client = createClient()
    const { result } = renderHook(() => useCreateFullProperty('admin-1'), { wrapper: wrapperFor(client) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(createFullProperty).toHaveBeenCalledWith({ ...INPUT, administrationId: 'admin-1' })
  })

  it('invalidates ["administration", administrationId, "properties"] on success', async () => {
    createFullProperty.mockResolvedValueOnce(undefined)
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCreateFullProperty('admin-1'), { wrapper: wrapperFor(client) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: propertyQueryKeys.list('admin-1') })
  })

  it('surfaces a repository failure as a mutation error', async () => {
    createFullProperty.mockRejectedValueOnce(new PropertyRepositoryError('Failed to create the property'))
    const client = createClient()
    const { result } = renderHook(() => useCreateFullProperty('admin-1'), { wrapper: wrapperFor(client) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})
