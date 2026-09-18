import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { ParkingRepositoryError } from '../domain/parking.types'
import { parkingQueryKeys } from './parking-query-keys'
import { useParkings } from './useParkings'

const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))

vi.mock('../infrastructure/supabase-parking.repository', () => ({
  supabaseParkingRepository: { listByAdministration, create: vi.fn() },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useParkings', () => {
  it('does not fetch while no administrationId is resolved yet', () => {
    const { result } = renderHook(() => useParkings(undefined), { wrapper })

    expect(listByAdministration).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches through the port, scoped under the administration query key, once an administrationId is resolved', async () => {
    listByAdministration.mockResolvedValueOnce([
      {
        id: 'parking-1',
        administrationId: 'admin-1',
        propertyId: null,
        identifier: 'Parqueadero 12',
        location: null,
        covered: null,
        allowedVehicleType: null,
      },
    ])

    const { result } = renderHook(() => useParkings('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(listByAdministration).toHaveBeenCalledWith('admin-1')
    expect(result.current.data).toHaveLength(1)
  })

  it('uses the ["administration", administrationId, "parkings"] key shape', () => {
    expect(parkingQueryKeys.list('admin-1')).toEqual(['administration', 'admin-1', 'parkings'])
  })

  it('surfaces a repository failure as a query error', async () => {
    listByAdministration.mockRejectedValueOnce(
      new ParkingRepositoryError('Failed to list parkings for the administration'),
    )

    const { result } = renderHook(() => useParkings('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})
