import type { HTMLAttributes } from 'react'
import { cx } from '@/shared/lib/cx'
import styles from './Alert.module.css'
import { AlertTriangleIcon, CheckIcon, InfoIcon } from './icons'

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone
  title?: string
}

const TONE_ICON = {
  info: InfoIcon,
  success: CheckIcon,
  warning: AlertTriangleIcon,
  danger: AlertTriangleIcon,
} as const satisfies Record<AlertTone, typeof InfoIcon>

export function Alert({ tone = 'info', title, className, children, ...props }: AlertProps) {
  const Icon = TONE_ICON[tone]
  const role = tone === 'danger' || tone === 'warning' ? 'alert' : 'status'

  return (
    <div role={role} className={cx(styles['alert'], styles[tone], className)} {...props}>
      <Icon size={18} className={styles['icon']} />
      <div>
        {title ? <p className={styles['title']}>{title}</p> : null}
        <div className={styles['body']}>{children}</div>
      </div>
    </div>
  )
}
