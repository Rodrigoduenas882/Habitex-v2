import type { CSSProperties, HTMLAttributes } from 'react'
import { cx } from '@/shared/lib/cx'
import styles from './Skeleton.module.css'

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: CSSProperties['width']
  height?: CSSProperties['height']
  radius?: 'sm' | 'md' | 'lg' | 'full'
}

export function Skeleton({
  width,
  height = '1em',
  radius = 'sm',
  className,
  style,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cx(styles['skeleton'], styles[radius], className)}
      style={{ width, height, ...style }}
      aria-hidden="true"
      {...props}
    />
  )
}
