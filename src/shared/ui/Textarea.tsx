import { forwardRef, useId, type TextareaHTMLAttributes } from 'react'
import { cx } from '@/shared/lib/cx'
import fieldStyles from './Field.module.css'
import styles from './Textarea.module.css'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  // Explicit `| undefined` so callers can pass react-hook-form's
  // `formState.errors.field?.message` directly under exactOptionalPropertyTypes.
  error?: string | undefined
  hint?: string | undefined
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, id, className, rows = 4, ...props },
  ref,
) {
  const generatedId = useId()
  const textareaId = id ?? generatedId
  const hintId = hint ? `${textareaId}-hint` : undefined
  const errorId = error ? `${textareaId}-error` : undefined

  return (
    <div className={cx(fieldStyles['field'], className)}>
      <label htmlFor={textareaId} className={fieldStyles['label']}>
        {label}
      </label>
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        className={cx(styles['textarea'], error && styles['textareaError'])}
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
