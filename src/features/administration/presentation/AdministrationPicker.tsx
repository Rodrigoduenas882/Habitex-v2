import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import type { AccessibleAdministration, AdministrationStatus } from '../domain/administration.types'
import styles from './AdministrationPicker.module.css'

export interface AdministrationPickerProps {
  options: readonly AccessibleAdministration[]
  onSelect: (id: string) => void
}

/**
 * ACTIVE is the one unambiguously normal state; SUSPENDED gets a warning
 * (something to pay attention to); ARCHIVED is a plain, non-urgent past
 * state. Same reasoning as RentalListCard's STATUS_TONE - existing semantic
 * tones only (DESIGN.md §6), no new palette.
 */
const STATUS_TONE: Record<AdministrationStatus, BadgeTone> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  ARCHIVED: 'neutral',
}

/**
 * Picks one administration out of useActiveAdministration()'s
 * 'selection-required' state. Every option stays selectable regardless of
 * status - SUSPENDED/ARCHIVED are shown as-is, not disabled, because this
 * is only a per-viewer navigation preference (see
 * administration-selection-storage.ts), not a business-rule guard; RLS and
 * the destination pages remain the authority on what a suspended/archived
 * administration can actually do.
 */
export function AdministrationPicker({ options, onSelect }: AdministrationPickerProps) {
  const { t } = useTranslation('administration')

  return (
    <div className={styles['picker']}>
      <div>
        <h2 className="text-h3">{t('picker.title')}</h2>
        <p className={cx('text-body-sm', 'text-muted', styles['description'])}>{t('picker.description')}</p>
      </div>
      <div role="radiogroup" aria-label={t('picker.title')} className={styles['list']}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={false}
            aria-label={t('picker.optionLabel', {
              name: option.name,
              status: t(`status.${option.status}`),
            })}
            className={styles['option']}
            onClick={() => {
              onSelect(option.id)
            }}
          >
            <span className={styles['name']} aria-hidden="true">
              {option.name}
            </span>
            <Badge tone={STATUS_TONE[option.status]} aria-hidden="true">
              {t(`status.${option.status}`)}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  )
}
