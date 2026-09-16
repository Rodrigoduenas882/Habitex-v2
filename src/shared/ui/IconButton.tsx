import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'
import styles from './IconButton.module.css'

export type IconButtonVariant = 'ghost' | 'secondary'
export type IconButtonSize = 'sm' | 'md'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  icon: ReactNode
  variant?: IconButtonVariant
  size?: IconButtonSize
  /** Icon-only button: an accessible name is required, not optional. */
  'aria-label': string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, variant = 'ghost', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(styles['iconButton'], styles[variant], styles[size], className)}
      {...props}
    >
      {icon}
    </button>
  )
})
