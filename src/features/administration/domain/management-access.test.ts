import { describe, expect, it } from 'vitest'
import type { Subscription, SubscriptionStatus } from './administration.types'
import { hasManagementAccess, hasRelationshipCapacity } from './management-access'

const BASE_SUBSCRIPTION: Subscription = {
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

const NOW = new Date('2026-09-23T00:00:00Z')

describe('hasManagementAccess', () => {
  it('returns false when there is no subscription row at all', () => {
    expect(hasManagementAccess(null, NOW)).toBe(false)
  })

  it.each<SubscriptionStatus>(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED'])(
    'returns true for status %s with no managementAccessUntil (unbounded access)',
    (status) => {
      expect(hasManagementAccess({ ...BASE_SUBSCRIPTION, status, managementAccessUntil: null }, NOW)).toBe(true)
    },
  )

  it('returns false for status EXPIRED regardless of managementAccessUntil', () => {
    expect(
      hasManagementAccess({ ...BASE_SUBSCRIPTION, status: 'EXPIRED', managementAccessUntil: '2027-01-01T00:00:00Z' }, NOW),
    ).toBe(false)
  })

  it('returns true while managementAccessUntil is still in the future', () => {
    expect(
      hasManagementAccess(
        { ...BASE_SUBSCRIPTION, status: 'TRIALING', managementAccessUntil: '2026-09-24T00:00:00Z' },
        NOW,
      ),
    ).toBe(true)
  })

  it('returns false once managementAccessUntil has passed', () => {
    expect(
      hasManagementAccess(
        { ...BASE_SUBSCRIPTION, status: 'TRIALING', managementAccessUntil: '2026-09-22T00:00:00Z' },
        NOW,
      ),
    ).toBe(false)
  })

  it('returns true at the exact managementAccessUntil instant (>=, not >)', () => {
    expect(
      hasManagementAccess({ ...BASE_SUBSCRIPTION, status: 'ACTIVE', managementAccessUntil: NOW.toISOString() }, NOW),
    ).toBe(true)
  })

  it('defaults `now` to the current time when not provided', () => {
    expect(hasManagementAccess({ ...BASE_SUBSCRIPTION, status: 'ACTIVE', managementAccessUntil: null })).toBe(true)
  })
})

describe('hasRelationshipCapacity', () => {
  it('returns false when there is no subscription row at all', () => {
    expect(hasRelationshipCapacity(null, 0)).toBe(false)
  })

  it('returns true when activeRelationshipLimit is null (unlimited)', () => {
    expect(hasRelationshipCapacity({ ...BASE_SUBSCRIPTION, activeRelationshipLimit: null }, 999)).toBe(true)
  })

  it('returns true when activeCount is below the limit', () => {
    expect(hasRelationshipCapacity({ ...BASE_SUBSCRIPTION, activeRelationshipLimit: 5 }, 4)).toBe(true)
  })

  it('returns false when activeCount already equals the limit', () => {
    expect(hasRelationshipCapacity({ ...BASE_SUBSCRIPTION, activeRelationshipLimit: 5 }, 5)).toBe(false)
  })

  it('returns false when activeCount exceeds the limit', () => {
    expect(hasRelationshipCapacity({ ...BASE_SUBSCRIPTION, activeRelationshipLimit: 5 }, 6)).toBe(false)
  })
})
