import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { AdministrationContextError, type Subscription } from '../domain/administration.types'
import { useManagementGate } from './useManagementGate'

const { getSubscription } = vi.hoisted(() => ({ getSubscription: vi.fn() }))

vi.mock('../infrastructure/supabase-subscription.repository', () => ({
  supabaseSubscriptionRepository: { getSubscription },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const ACTIVE_SUBSCRIPTION: Subscription = {
  id: 'sub-1',
  administrationId: 'admin-1',
  status: 'ACTIVE',
  planCode: 'starter',
  trialStartedAt: null,
  trialEndsAt: null,
  currentPeriodStartsAt: null,
  currentPeriodEndsAt: null,
  managementAccessUntil: null,
  activeRelationshipLimit: null,
}

const EXPIRED_SUBSCRIPTION: Subscription = { ...ACTIVE_SUBSCRIPTION, status: 'EXPIRED' }

describe('useManagementGate', () => {
  it('is not blocked while the subscription is still loading', () => {
    getSubscription.mockReturnValueOnce(new Promise(() => {}))

    const { result } = renderHook(() => useManagementGate('admin-1'), { wrapper })

    expect(result.current.blocked).toBe(false)
  })

  it('is not blocked when the subscription query errors - fails open, not closed', async () => {
    getSubscription.mockRejectedValueOnce(
      new AdministrationContextError('Failed to resolve the administration subscription'),
    )

    const { result } = renderHook(() => useManagementGate('admin-1'), { wrapper })

    await waitFor(() => {
      expect(getSubscription).toHaveBeenCalled()
    })
    expect(result.current.blocked).toBe(false)
  })

  it('is not blocked once resolved with a subscription that grants management access', async () => {
    getSubscription.mockResolvedValueOnce(ACTIVE_SUBSCRIPTION)

    const { result } = renderHook(() => useManagementGate('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.subscription).toEqual(ACTIVE_SUBSCRIPTION)
    })
    expect(result.current.blocked).toBe(false)
  })

  it('is blocked once resolved with an EXPIRED subscription', async () => {
    getSubscription.mockResolvedValueOnce(EXPIRED_SUBSCRIPTION)

    const { result } = renderHook(() => useManagementGate('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.subscription).toEqual(EXPIRED_SUBSCRIPTION)
    })
    expect(result.current.blocked).toBe(true)
  })

  it('is blocked once resolved with managementAccessUntil already in the past', async () => {
    getSubscription.mockResolvedValueOnce({
      ...ACTIVE_SUBSCRIPTION,
      status: 'TRIALING',
      managementAccessUntil: '2000-01-01T00:00:00Z',
    })

    const { result } = renderHook(() => useManagementGate('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.subscription).not.toBeUndefined()
    })
    expect(result.current.blocked).toBe(true)
  })

  it('stays non-blocking while administrationId is null/undefined (query stays disabled)', () => {
    const { result } = renderHook(() => useManagementGate(null), { wrapper })

    expect(result.current.blocked).toBe(false)
    expect(getSubscription).not.toHaveBeenCalled()
  })
})
