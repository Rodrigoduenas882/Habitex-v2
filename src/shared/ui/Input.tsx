import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cx } from '@/shared/lib/cx'
import fieldStyles from './Field.module.css'
import styles from './Input.module.css'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined

  return (
    <div className={cx(fieldStyles['field'], className)}>
      <label htmlFor={inputId} className={fieldStyles['label']}>
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={cx(styles['input'], error && styles['inputError'])}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={cx(hintId, errorId) || undefined}
        {...props}
      />
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
