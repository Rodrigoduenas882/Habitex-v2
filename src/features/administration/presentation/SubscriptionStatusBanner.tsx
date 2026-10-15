import { useTranslation } from 'react-i18next'
import { Alert, type AlertTone } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { useActiveAdministration } from '../application/useActiveAdministration'
import { useSubscription } from '../application/useSubscription'
import type { Subscription } from '../domain/administration.types'
import styles from './SubscriptionStatusBanner.module.css'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Ceil so "less than a day left" still reads as 1, never 0. */
function daysUntil(targetIso: string, now: Date): number {
  return Math.ceil((new Date(targetIso).getTime() - now.getTime()) / MS_PER_DAY)
}

type BannerState =
  | { kind: 'trial'; tone: AlertTone; days: number }
  | { kind: 'grace'; tone: AlertTone; days: number }
  | { kind: 'pastDue'; tone: AlertTone }
  | { kind: 'expired'; tone: AlertTone }
  | { kind: 'canceled'; tone: AlertTone }

/**
 * Pure decision function, order-sensitive (first match wins) - mirrors the
 * exact rule order from the INC-003 spec:
 *  1. ACTIVE -> no banner.
 *  2. TRIALING, still inside the trial window -> info, days until
 *     trial_ends_at.
 *  3. TRIALING, trial over but still inside the grace window
 *     (management_access_until) -> warning, days until
 *     management_access_until.
 *  4. PAST_DUE -> warning, unconditionally - checked before the danger
 *     catch-all below, even if management_access_until has also expired.
 *     That ordering is a deliberate spec decision, not an oversight.
 *  5. EXPIRED, or *any* status whose management_access_until has already
 *     passed -> danger.
 *  6. CANCELED -> danger.
 * Never derives/assumes an interval length (trial/grace duration) - only
 * ever diffs two timestamps the backend already returned.
 */
function resolveBannerState(subscription: Subscription, now: Date): BannerState | null {
  const { status, trialEndsAt, managementAccessUntil } = subscription

  if (status === 'ACTIVE') {
    return null
  }

  if (status === 'TRIALING' && trialEndsAt && now.getTime() < new Date(trialEndsAt).getTime()) {
    return { kind: 'trial', tone: 'info', days: daysUntil(trialEndsAt, now) }
  }

  if (
    status === 'TRIALING' &&
    trialEndsAt &&
    now.getTime() >= new Date(trialEndsAt).getTime() &&
    managementAccessUntil &&
    now.getTime() < new Date(managementAccessUntil).getTime()
  ) {
    return { kind: 'grace', tone: 'warning', days: daysUntil(managementAccessUntil, now) }
  }

  if (status === 'PAST_DUE') {
    return { kind: 'pastDue', tone: 'warning' }
  }

  if (
    status === 'EXPIRED' ||
    (managementAccessUntil != null && now.getTime() >= new Date(managementAccessUntil).getTime())
  ) {
    return { kind: 'expired', tone: 'danger' }
  }

  if (status === 'CANCELED') {
    return { kind: 'canceled', tone: 'danger' }
  }

  return null
}

/**
 * Read-only, supplementary informational widget - never a security/auth
 * gate (contrast with RequiresAccount/RedirectIfAccountExists, which fail
 * closed with a visible retry because they *are* security-relevant). This
 * one fails silent: while the active administration or the subscription
 * hasn't resolved yet, on any error, or once resolved to null/ACTIVE, it
 * renders nothing at all - no spinner, no error alert.
 *
 * The "Ver planes" CTA is deliberately disabled (aria-disabled, no
 * onClick/navigation) - real plan checkout/routing is POST-002/INC-004, out
 * of scope here. Known follow-up debt, not an oversight.
 */
export function SubscriptionStatusBanner() {
  const { t } = useTranslation('administration')
  const activeAdministration = useActiveAdministration()
  const administrationId =
    activeAdministration.status === 'resolved' ? activeAdministration.administration.id : null
  const subscriptionQuery = useSubscription(administrationId)

  if (activeAdministration.status !== 'resolved') {
    return null
  }

  if (subscriptionQuery.isLoading || subscriptionQuery.isError || subscriptionQuery.data == null) {
    return null
  }

  const bannerState = resolveBannerState(subscriptionQuery.data, new Date())

  if (bannerState == null) {
    return null
  }

  const message =
    bannerState.kind === 'trial'
      ? t('subscriptionBanner.trial.message', { count: bannerState.days })
      : bannerState.kind === 'grace'
        ? t('subscriptionBanner.grace.message', { count: bannerState.days })
        : bannerState.kind === 'pastDue'
          ? t('subscriptionBanner.pastDue.message')
          : bannerState.kind === 'expired'
            ? t('subscriptionBanner.expired.message')
            : t('subscriptionBanner.canceled.message')

  return (
    <Alert tone={bannerState.tone} className={styles['banner']}>
      {message}
      <div className={styles['cta']}>
        <Button variant="secondary" size="sm" disabled aria-disabled="true">
          {t('subscriptionBanner.viewPlansCta')}
        </Button>
      </div>
    </Alert>
  )
}
