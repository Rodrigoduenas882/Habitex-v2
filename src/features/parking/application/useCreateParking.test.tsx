import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ParkingRepositoryError } from '../domain/parking.types'
import { useCreateParking } from './useCreateParking'

const { create } = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('../infrastructure/supabase-parking.repository', () => ({
  supabaseParkingRepository: { create },
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
  administrationId: 'admin-1',
  propertyId: null,
  identifier: 'Parqueadero 12',
  location: null,
  covered: null,
  allowedVehicleType: null,
  accessType: null,
  observations: null,
}

describe('useCreateParking', () => {
  it('calls the repository through the port with the submitted input', async () => {
    create.mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useCreateParking(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(create).toHaveBeenCalledWith(INPUT)
  })

  it('surfaces a repository failure as a mutation error', async () => {
    create.mockRejectedValueOnce(new ParkingRepositoryError('Failed to create the parking'))
    const { result } = renderHook(() => useCreateParking(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })

  it('does not invalidate the properties query - create_parking_asset never touches properties', async () => {
    create.mockResolvedValueOnce(undefined)
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCreateParking(), { wrapper: wrapperFor(client) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
