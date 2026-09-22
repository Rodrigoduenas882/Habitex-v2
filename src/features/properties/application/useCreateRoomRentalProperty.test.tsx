import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PropertyRepositoryError } from '../domain/property.types'
import { propertyQueryKeys } from './property-query-keys'
import { useCreateRoomRentalProperty } from './useCreateRoomRentalProperty'

const { createRoomRentalProperty } = vi.hoisted(() => ({ createRoomRentalProperty: vi.fn() }))

vi.mock('../infrastructure/supabase-property.repository', () => ({
  supabasePropertyRepository: {
    createRoomRentalProperty,
    createFullProperty: vi.fn(),
    listByAdministration: vi.fn(),
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

const INPUT = {
  propertyType: 'HOUSE' as const,
  name: 'Casa 14',
  city: 'Medellín',
  address: 'Cra 1 # 2-3',
  countryCode: 'CO',
  hasAdministration: false,
  administrationFee: null,
}

const CREATED_PROPERTY = {
  id: 'prop-2',
  administrationId: 'admin-1',
  propertyType: 'HOUSE' as const,
  rentalMode: 'BY_ROOMS' as const,
  name: 'Casa 14',
  countryCode: 'CO',
  city: 'Medellín',
  address: 'Cra 1 # 2-3',
  hasAdministration: false,
  administrationFee: null,
}

describe('useCreateRoomRentalProperty', () => {
  it('calls the repository through the port with the administrationId merged in', async () => {
    createRoomRentalProperty.mockResolvedValueOnce(CREATED_PROPERTY)
    const client = createClient()
    const { result } = renderHook(() => useCreateRoomRentalProperty('admin-1'), {
      wrapper: wrapperFor(client),
    })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(createRoomRentalProperty).toHaveBeenCalledWith({ ...INPUT, administrationId: 'admin-1' })
  })

  it('resolves the created Property, so the caller can read its id', async () => {
    createRoomRentalProperty.mockResolvedValueOnce(CREATED_PROPERTY)
    const client = createClient()
    const { result } = renderHook(() => useCreateRoomRentalProperty('admin-1'), {
      wrapper: wrapperFor(client),
    })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.id).toBe('prop-2')
  })

  it('invalidates ["administration", administrationId, "properties"] on success', async () => {
    createRoomRentalProperty.mockResolvedValueOnce(CREATED_PROPERTY)
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCreateRoomRentalProperty('admin-1'), {
      wrapper: wrapperFor(client),
    })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: propertyQueryKeys.list('admin-1') })
  })

  it('surfaces a repository failure as a mutation error', async () => {
    createRoomRentalProperty.mockRejectedValueOnce(
      new PropertyRepositoryError('Failed to create the property'),
    )
    const client = createClient()
    const { result } = renderHook(() => useCreateRoomRentalProperty('admin-1'), {
      wrapper: wrapperFor(client),
    })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})
