import type { HTMLAttributes } from 'react'
import { cx } from '@/shared/lib/cx'
import styles from './Badge.module.css'

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

/**
 * Presentational only: callers pass the (translated) label and pick a tone.
 * Domain status → tone mapping belongs to the feature using it, not here.
 */
export function Badge({ tone = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span className={cx(styles['badge'], styles[tone], className)} {...props}>
      {children}
    </span>
  )
}
