import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { RentalRepositoryError } from '../domain/rental.types'
import { rentalQueryKeys } from './rental-query-keys'
import { useRentals } from './useRentals'

const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))

vi.mock('../infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: { listByAdministration },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useRentals', () => {
  it('does not fetch while no administrationId is resolved yet', () => {
    const { result } = renderHook(() => useRentals(undefined), { wrapper })

    expect(listByAdministration).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches through the port, scoped under the administration query key, once an administrationId is resolved', async () => {
    listByAdministration.mockResolvedValueOnce([
      {
        id: 'rental-1',
        administrationId: 'admin-1',
        status: 'ACTIVE',
        jurisdictionCountry: 'CO',
        realStartDate: null,
        trackingStartDate: null,
        expectedEndDate: null,
        actualEndDate: null,
        paymentDay: null,
        paymentTiming: null,
      },
    ])

    const { result } = renderHook(() => useRentals('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(listByAdministration).toHaveBeenCalledWith('admin-1')
    expect(result.current.data).toHaveLength(1)
  })

  it('uses the ["administration", administrationId, "rentals"] key shape', () => {
    expect(rentalQueryKeys.list('admin-1')).toEqual(['administration', 'admin-1', 'rentals'])
  })

  it('surfaces a repository failure as a query error', async () => {
    listByAdministration.mockRejectedValueOnce(
      new RentalRepositoryError('Failed to list rental relationships for the administration'),
    )

    const { result } = renderHook(() => useRentals('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})
