import { cx } from '@/shared/lib/cx'
import styles from './Avatar.module.css'

export interface AvatarProps {
  name: string
  src?: string
  size?: number
  className?: string
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function Avatar({ name, src, size = 36, className }: AvatarProps) {
  const style = { width: size, height: size }

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cx(styles['avatar'], className)}
        style={style}
        width={size}
        height={size}
      />
    )
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={cx(styles['avatar'], styles['fallback'], className)}
      style={style}
    >
      {getInitials(name)}
    </span>
  )
}
