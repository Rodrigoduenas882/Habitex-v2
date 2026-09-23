import type { Subscription, SubscriptionStatus } from './administration.types'

const ACCESS_GRANTING_STATUSES: readonly SubscriptionStatus[] = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED']

/**
 * Pure, read-only UX mirror of the backend's has_management_access() SQL
 * function (see activate_rental_relationship and friends) - RLS/the RPC
 * itself remain the real security boundary regardless of what this returns;
 * this only decides what the UI proactively disables/explains. Never derives
 * an interval length - only ever diffs subscription.managementAccessUntil
 * against `now` (same principle as SubscriptionStatusBanner's
 * resolveBannerState).
 */
export function hasManagementAccess(subscription: Subscription | null, now: Date = new Date()): boolean {
  if (subscription == null) return false
  if (!ACCESS_GRANTING_STATUSES.includes(subscription.status)) return false
  if (subscription.managementAccessUntil == null) return true
  return new Date(subscription.managementAccessUntil).getTime() >= now.getTime()
}

/**
 * Pure, read-only UX mirror of the capacity check inside
 * activate_rental_relationship() (v_sub.active_relationship_limit is not
 * null and active_relationship_count(...) >= v_sub.active_relationship_limit
 * -> RELATIONSHIP_CAPACITY_REACHED). The RPC remains authoritative - a stale
 * client-side activeCount can never suppress or replace calling it.
 * activeCount is supplied by the caller (e.g. rental.types'
 * activeRelationshipCount), never fetched here.
 */
export function hasRelationshipCapacity(subscription: Subscription | null, activeCount: number): boolean {
  if (subscription == null) return false
  if (subscription.activeRelationshipLimit == null) return true
  return activeCount < subscription.activeRelationshipLimit
}
