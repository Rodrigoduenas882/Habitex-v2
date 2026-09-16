import type { HTMLAttributes } from 'react'
import { cx } from '@/shared/lib/cx'
import styles from './Card.module.css'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
}

export function Card({ interactive = false, className, ...props }: CardProps) {
  return (
    <div className={cx(styles['card'], interactive && styles['interactive'], className)} {...props} />
  )
}
