import type { ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'
import styles from './EmptyState.module.css'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx(styles['emptyState'], className)}>
      {icon ? (
        <div className={styles['icon']} aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className={styles['title']}>{title}</p>
      {description ? <p className={styles['description']}>{description}</p> : null}
      {action ? <div className={styles['action']}>{action}</div> : null}
    </div>
  )
}
