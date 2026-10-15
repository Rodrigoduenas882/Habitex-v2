import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  AdministrationContextError,
  type Subscription,
  type SubscriptionRepository,
  type SubscriptionStatus,
} from '../domain/administration.types'

interface SubscriptionRow {
  id: string
  administration_id: string
  status: SubscriptionStatus
  plan_code: string
  trial_started_at: string | null
  trial_ends_at: string | null
  current_period_starts_at: string | null
  current_period_ends_at: string | null
  management_access_until: string | null
  active_relationship_limit: number | null
}

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    administrationId: row.administration_id,
    status: row.status,
    planCode: row.plan_code,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    currentPeriodStartsAt: row.current_period_starts_at,
    currentPeriodEndsAt: row.current_period_ends_at,
    managementAccessUntil: row.management_access_until,
    activeRelationshipLimit: row.active_relationship_limit,
  }
}

export const supabaseSubscriptionRepository: SubscriptionRepository = {
  async getSubscription(administrationId: string) {
    // RLS (administration_subscriptions_select: is_administration_member)
    // already scopes this to administrations the current person belongs to
    // - the .eq() filter here is which administration, not an access check.
    const { data, error } = await supabaseClient
      .from('administration_subscriptions')
      .select(
        'id, administration_id, status, plan_code, trial_started_at, trial_ends_at, current_period_starts_at, current_period_ends_at, management_access_until, active_relationship_limit',
      )
      .eq('administration_id', administrationId)
      .maybeSingle()

    if (error) {
      throw new AdministrationContextError('Failed to resolve the administration subscription', error)
    }

    return data ? toSubscription(data) : null
  },
}
