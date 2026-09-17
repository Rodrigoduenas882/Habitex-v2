import type { ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'
import styles from './IconBadge.module.css'

export type IconBadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
export type IconBadgeRadius = 'sm' | 'md' | 'lg' | 'full'

export interface IconBadgeProps {
  icon: ReactNode
  tone: IconBadgeTone
  /** Container size in px - each caller picks its own to match that
   * screen's visual hierarchy (a KPI, a quick action and a list row read at
   * different weights on purpose; this shares the pattern, not the size). */
  size: number
  radius?: IconBadgeRadius
  className?: string | undefined
}

/**
 * The "icon inside a small tinted rounded container" pattern that KpiCard,
 * QuickActions, AttentionPanel and the property "add" card each used to
 * hand-roll separately, at their own size/radius. This centralizes the
 * shape and the tone->token pairing (shared/theme/tone.module.css); callers
 * still choose size/radius/tone to match their own approved design.
 */
export function IconBadge({ icon, tone, size, radius = 'md', className }: IconBadgeProps) {
  return (
    <span
      className={cx(styles['iconBadge'], styles[tone], styles[radius], className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {icon}
    </span>
  )
}
