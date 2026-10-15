import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '@/shared/lib/cx'
import { Card } from '@/shared/ui/Card'
import { IconBadge, type IconBadgeTone } from '@/shared/ui/IconBadge'
import { ArrowRightIcon } from '@/shared/ui/icons'
import styles from './KpiCard.module.css'

export type KpiTone = 'success' | 'warning' | 'info' | 'neutral'

/** KpiCard's own tone vocabulary predates IconBadge's - "neutral" here has
 * always looked like IconBadge's "primary" tone (see KpiCard.module.css). */
const ICON_BADGE_TONE: Record<KpiTone, IconBadgeTone> = {
  success: 'success',
  warning: 'warning',
  info: 'info',
  neutral: 'primary',
}

export interface KpiCardProps {
  icon: ReactNode
  label: string
  /**
   * Usually a formatted string, but deliberately ReactNode - a loading
   * (Skeleton) or "no data" (em-dash) sub-state renders through this same
   * prop instead of a separate loading/error prop, since the happy-path
   * value/trend markup doesn't need to change shape for those states.
   */
  value: ReactNode
  tone: KpiTone
  /** Short optional context/variation line, e.g. "↑ 8,4% vs. mes anterior". */
  trend?: ReactNode
  trendTone?: 'positive' | 'neutral' | undefined
  /**
   * Optional honest navigation destination for this specific KPI (DS-004) -
   * only set when a real page actually represents that same data (e.g.
   * "Inmuebles" -> /properties, a 1:1 match with the properties list this
   * count is drawn from). When omitted, the card renders exactly as before:
   * a plain, non-interactive Card, no link/button role anywhere in it. Most
   * KPIs on this dashboard have no administration-wide page to point to and
   * must stay informational-only - this prop is never a reason to invent one.
   */
  to?: string
}

export function KpiCard({ icon, label, value, tone, trend, trendTone = 'neutral', to }: KpiCardProps) {
  const card = (
    <Card className={styles['card']} interactive={Boolean(to)}>
      <div className={styles['top']}>
        <p className="text-caption">{label}</p>
        {to ? (
          <div className={styles['topEnd']}>
            <IconBadge icon={icon} tone={ICON_BADGE_TONE[tone]} size={30} radius="md" />
            <ArrowRightIcon size={14} className={styles['arrow']} />
          </div>
        ) : (
          <IconBadge icon={icon} tone={ICON_BADGE_TONE[tone]} size={30} radius="md" />
        )}
      </div>
      <div className={cx('text-h1', 'tabular-nums', styles['value'])}>{value}</div>
      {trend ? (
        <div
          className={cx(
            'text-caption',
            styles['trend'],
            trendTone === 'positive' && styles['trendPositive'],
          )}
        >
          {trend}
        </div>
      ) : null}
    </Card>
  )

  if (to) {
    return (
      <Link to={to} className={styles['link']}>
        {card}
      </Link>
    )
  }

  return card
}
