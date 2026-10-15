import { hasManagementAccess } from '../domain/management-access'
import type { Subscription } from '../domain/administration.types'
import { useSubscription } from './useSubscription'

export interface ManagementGateResult {
  /**
   * true only once subscription data has resolved AND clearly disallows
   * management actions. Never true while loading or on a query error - this
   * is a UX-only convenience gate (see management-access.ts), not the
   * security boundary (RLS + the RPC itself are), so it deliberately fails
   * *open* rather than closed while the real state is unknown - unlike
   * RequiresAccount/RedirectIfAccountExists, which fail closed because they
   * guard something security-relevant.
   */
  blocked: boolean
  subscription: Subscription | null | undefined
}

/**
 * Wraps useSubscription(administrationId) into the shape inline action
 * gates (activate a rental, create a rental draft, ...) need, without ever
 * flashing a disabled state while the subscription is still loading.
 */
export function useManagementGate(administrationId: string | null | undefined): ManagementGateResult {
  const subscriptionQuery = useSubscription(administrationId)

  // isPending (not isLoading) on purpose: a disabled query (no
  // administrationId yet) never fetches, so isLoading is false for it too -
  // but it still has no data, and must stay non-blocking just like a real
  // in-flight load.
  if (subscriptionQuery.isPending || subscriptionQuery.isError) {
    return { blocked: false, subscription: subscriptionQuery.data }
  }

  const subscription = subscriptionQuery.data ?? null

  return { blocked: !hasManagementAccess(subscription), subscription }
}
