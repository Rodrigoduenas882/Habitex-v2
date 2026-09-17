import { forwardRef, useId, type SelectHTMLAttributes } from 'react'
import { cx } from '@/shared/lib/cx'
import fieldStyles from './Field.module.css'
import { ChevronDownIcon } from './icons'
import styles from './Select.module.css'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  // Explicit `| undefined` so callers can pass react-hook-form's
  // `formState.errors.field?.message` directly under exactOptionalPropertyTypes.
  error?: string | undefined
  hint?: string | undefined
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, id, className, children, ...props },
  ref,
) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const hintId = hint ? `${selectId}-hint` : undefined
  const errorId = error ? `${selectId}-error` : undefined

  return (
    <div className={cx(fieldStyles['field'], className)}>
      <label htmlFor={selectId} className={fieldStyles['label']}>
        {label}
      </label>
      <div className={styles['selectWrapper']}>
        <select
          ref={ref}
          id={selectId}
          className={cx(styles['select'], error && styles['selectError'])}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={cx(hintId, errorId) || undefined}
          {...props}
        >
          {children}
        </select>
        <ChevronDownIcon size={16} className={styles['chevron']} />
      </div>
      {hint && !error ? (
        <p id={hintId} className={fieldStyles['hint']}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={fieldStyles['error']} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
})
