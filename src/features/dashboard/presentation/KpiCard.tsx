import type { ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'
import { Card } from '@/shared/ui/Card'
import { IconBadge, type IconBadgeTone } from '@/shared/ui/IconBadge'
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
}

export function KpiCard({ icon, label, value, tone, trend, trendTone = 'neutral' }: KpiCardProps) {
  return (
    <Card className={styles['card']}>
      <div className={styles['top']}>
        <p className="text-caption">{label}</p>
        <IconBadge icon={icon} tone={ICON_BADGE_TONE[tone]} size={30} radius="md" />
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
}
