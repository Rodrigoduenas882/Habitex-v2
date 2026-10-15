import { describe, expect, it, vi } from 'vitest'
import { AdministrationContextError } from '../domain/administration.types'

const { maybeSingle, eq, select, from } = vi.hoisted(() => {
  const maybeSingle = vi.fn()
  const eq = vi.fn((_column: string, _value: string) => ({ maybeSingle }))
  const select = vi.fn((_columns: string) => ({ eq }))
  const from = vi.fn((_table: string) => ({ select }))
  return { maybeSingle, eq, select, from }
})

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: { from },
}))

import { supabaseSubscriptionRepository } from './supabase-subscription.repository'

const ROW = {
  id: 'sub-1',
  administration_id: 'admin-1',
  status: 'TRIALING',
  plan_code: 'starter',
  trial_started_at: '2026-09-01T00:00:00Z',
  trial_ends_at: '2026-09-15T00:00:00Z',
  current_period_starts_at: null,
  current_period_ends_at: null,
  management_access_until: null,
  active_relationship_limit: 10,
}

describe('supabaseSubscriptionRepository.getSubscription', () => {
  it('queries administration_subscriptions scoped by administration_id and maps snake_case rows to the domain shape', async () => {
    maybeSingle.mockResolvedValueOnce({ data: ROW, error: null })

    const result = await supabaseSubscriptionRepository.getSubscription('admin-1')

    expect(from).toHaveBeenCalledWith('administration_subscriptions')
    expect(eq).toHaveBeenCalledWith('administration_id', 'admin-1')
    expect(result).toEqual({
      id: 'sub-1',
      administrationId: 'admin-1',
      status: 'TRIALING',
      planCode: 'starter',
      trialStartedAt: '2026-09-01T00:00:00Z',
      trialEndsAt: '2026-09-15T00:00:00Z',
      currentPeriodStartsAt: null,
      currentPeriodEndsAt: null,
      managementAccessUntil: null,
      activeRelationshipLimit: 10,
    })
  })

  it('never selects every column with *', () => {
    for (const [columns] of select.mock.calls) {
      expect(columns).not.toBe('*')
      expect(columns).not.toContain('*')
    }
  })

  it('resolves to null when no subscription row exists yet for that administration', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await supabaseSubscriptionRepository.getSubscription('admin-1')

    expect(result).toBeNull()
  })

  it('wraps a Supabase failure in AdministrationContextError instead of throwing the raw error', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(supabaseSubscriptionRepository.getSubscription('admin-1')).rejects.toBeInstanceOf(
      AdministrationContextError,
    )
  })
})
