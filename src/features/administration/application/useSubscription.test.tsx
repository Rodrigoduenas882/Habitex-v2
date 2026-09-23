import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { AdministrationContextError } from '../domain/administration.types'
import { useSubscription } from './useSubscription'

const { getSubscription } = vi.hoisted(() => ({ getSubscription: vi.fn() }))

vi.mock('../infrastructure/supabase-subscription.repository', () => ({
  supabaseSubscriptionRepository: { getSubscription },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const SUBSCRIPTION = {
  id: 'sub-1',
  administrationId: 'admin-1',
  status: 'TRIALING' as const,
  planCode: 'starter',
  trialStartedAt: '2026-09-01T00:00:00Z',
  trialEndsAt: '2026-09-15T00:00:00Z',
  currentPeriodStartsAt: null,
  currentPeriodEndsAt: null,
  managementAccessUntil: null,
  activeRelationshipLimit: 10,
}

describe('useSubscription', () => {
  it('resolves the subscription of the given administration through the port', async () => {
    getSubscription.mockResolvedValueOnce(SUBSCRIPTION)

    const { result } = renderHook(() => useSubscription('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(getSubscription).toHaveBeenCalledWith('admin-1')
    expect(result.current.data).toEqual(SUBSCRIPTION)
  })

  it('resolves to null when no subscription row exists yet, not as an error', async () => {
    getSubscription.mockResolvedValueOnce(null)

    const { result } = renderHook(() => useSubscription('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBeNull()
  })

  it('stays disabled and never calls the port while administrationId is null/undefined', () => {
    const { result: withNull } = renderHook(() => useSubscription(null), { wrapper })
    const { result: withUndefined } = renderHook(() => useSubscription(undefined), { wrapper })

    expect(withNull.current.fetchStatus).toBe('idle')
    expect(withUndefined.current.fetchStatus).toBe('idle')
    expect(getSubscription).not.toHaveBeenCalled()
  })

  it('surfaces a repository failure as a query error, not a swallowed null', async () => {
    getSubscription.mockRejectedValueOnce(
      new AdministrationContextError('Failed to resolve the administration subscription'),
    )

    const { result } = renderHook(() => useSubscription('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})
