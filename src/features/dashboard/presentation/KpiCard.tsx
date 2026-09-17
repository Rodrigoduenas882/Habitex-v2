import type { ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'
import { Card } from '@/shared/ui/Card'
import styles from './KpiCard.module.css'

export type KpiTone = 'success' | 'warning' | 'info' | 'neutral'

const TONE_CLASS: Record<KpiTone, string> = {
  success: 'toneSuccess',
  warning: 'toneWarning',
  info: 'toneInfo',
  neutral: 'toneNeutral',
}

export interface KpiCardProps {
  icon: ReactNode
  label: string
  value: string
  tone: KpiTone
  /** Short optional context/variation line, e.g. "↑ 8,4% vs. mes anterior". */
  trend?: string | undefined
  trendTone?: 'positive' | 'neutral' | undefined
}

export function KpiCard({ icon, label, value, tone, trend, trendTone = 'neutral' }: KpiCardProps) {
  return (
    <Card className={styles['card']}>
      <div className={styles['top']}>
        <p className="text-caption">{label}</p>
        <span className={cx(styles['iconBadge'], styles[TONE_CLASS[tone]])} aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className={cx('text-h1', 'tabular-nums', styles['value'])}>{value}</p>
      {trend ? (
        <p
          className={cx(
            'text-caption',
            styles['trend'],
            trendTone === 'positive' && styles['trendPositive'],
          )}
        >
          {trend}
        </p>
      ) : null}
    </Card>
  )
}
