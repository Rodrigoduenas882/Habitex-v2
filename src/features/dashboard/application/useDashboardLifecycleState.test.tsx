import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { useDashboardLifecycleState } from './useDashboardLifecycleState'

const { listProperties } = vi.hoisted(() => ({ listProperties: vi.fn() }))
const { listRentals } = vi.hoisted(() => ({ listRentals: vi.fn() }))

vi.mock('@/features/properties/infrastructure/supabase-property.repository', () => ({
  supabasePropertyRepository: { listByAdministration: listProperties },
}))

vi.mock('@/features/rentals/infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: { listByAdministration: listRentals },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function property(id: string) {
  return {
    id,
    administrationId: 'admin-1',
    propertyType: 'APARTMENT' as const,
    rentalMode: 'FULL_PROPERTY' as const,
    name: `Property ${id}`,
    countryCode: 'CO',
    city: 'Bogotá',
    address: 'Calle 1',
    hasAdministration: false,
    administrationFee: null,
  }
}

function rental(id: string) {
  return {
    id,
    administrationId: 'admin-1',
    status: 'ACTIVE' as const,
    jurisdictionCountry: 'CO',
    realStartDate: '2026-01-01',
    trackingStartDate: '2026-01-01',
    expectedEndDate: null,
    actualEndDate: null,
    paymentDay: 5,
    paymentTiming: 'ADVANCE' as const,
  }
}

describe('useDashboardLifecycleState', () => {
  it('reports "loading" while properties is still pending, even if rentals already resolved', () => {
    listProperties.mockReturnValueOnce(new Promise(() => {}))
    listRentals.mockResolvedValueOnce([])

    const { result } = renderHook(() => useDashboardLifecycleState('admin-1'), { wrapper })

    expect(result.current).toEqual({ status: 'loading' })
  })

  it('reports "loading" while rentals is still pending, even if properties already resolved', () => {
    listProperties.mockResolvedValueOnce([])
    listRentals.mockReturnValueOnce(new Promise(() => {}))

    const { result } = renderHook(() => useDashboardLifecycleState('admin-1'), { wrapper })

    expect(result.current).toEqual({ status: 'loading' })
  })

  it('reports "error" when properties fails, never confusing it with "new-owner"', async () => {
    listProperties.mockRejectedValueOnce(new Error('boom'))
    listRentals.mockResolvedValueOnce([])

    const { result } = renderHook(() => useDashboardLifecycleState('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'error' })
    })
    expect(result.current).not.toEqual({ status: 'new-owner' })
  })

  it('reports "error" when rentals fails, never confusing it with "new-owner" or "has-properties"', async () => {
    listProperties.mockResolvedValueOnce([property('prop-1')])
    listRentals.mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() => useDashboardLifecycleState('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'error' })
    })
    expect(result.current).not.toEqual({ status: 'new-owner' })
    expect(result.current).not.toEqual({ status: 'has-properties' })
  })

  it('reports "new-owner" when there are zero properties, regardless of rentals', async () => {
    listProperties.mockResolvedValueOnce([])
    listRentals.mockResolvedValueOnce([])

    const { result } = renderHook(() => useDashboardLifecycleState('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'new-owner' })
    })
  })

  it('reports "has-properties" when there is at least one property and zero rentals', async () => {
    listProperties.mockResolvedValueOnce([property('prop-1')])
    listRentals.mockResolvedValueOnce([])

    const { result } = renderHook(() => useDashboardLifecycleState('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'has-properties' })
    })
  })

  it('reports "has-rentals" when there is at least one property and at least one rental', async () => {
    listProperties.mockResolvedValueOnce([property('prop-1')])
    listRentals.mockResolvedValueOnce([rental('rel-1')])

    const { result } = renderHook(() => useDashboardLifecycleState('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'has-rentals' })
    })
  })
})
