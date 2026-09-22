import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { IconBadge } from '@/shared/ui/IconBadge'
import { BuildingIcon, CarIcon, KeyIcon } from '@/shared/ui/icons'
import type { RentalSubjectType } from '../domain/rental-subject.types'
import styles from './RentalSubjectTypeSelector.module.css'

export interface RentalSubjectTypeSelectorProps {
  onSelect: (option: RentalSubjectType) => void
}

/** "¿Qué vas a arrendar?" - a radiogroup of the three real subjectType values. */
export function RentalSubjectTypeSelector({ onSelect }: RentalSubjectTypeSelectorProps) {
  const { t } = useTranslation('rentals')

  return (
    <div role="radiogroup" aria-label={t('addRental.title')} className={styles['grid']}>
      <button
        type="button"
        role="radio"
        aria-checked={false}
        aria-label={t('addRental.optionFullProperty.title')}
        className={styles['option']}
        onClick={() => {
          onSelect('FULL_PROPERTY')
        }}
      >
        <IconBadge icon={<BuildingIcon size={20} />} tone="primary" size={40} radius="md" />
        <p className="text-h3" aria-hidden="true">
          {t('addRental.optionFullProperty.title')}
        </p>
        <p className={cx('text-body-sm', 'text-muted')}>{t('addRental.optionFullProperty.description')}</p>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={false}
        aria-label={t('addRental.optionRoom.title')}
        className={styles['option']}
        onClick={() => {
          onSelect('ROOM')
        }}
      >
        <IconBadge icon={<KeyIcon size={20} />} tone="primary" size={40} radius="md" />
        <p className="text-h3" aria-hidden="true">
          {t('addRental.optionRoom.title')}
        </p>
        <p className={cx('text-body-sm', 'text-muted')}>{t('addRental.optionRoom.description')}</p>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={false}
        aria-label={t('addRental.optionParking.title')}
        className={styles['option']}
        onClick={() => {
          onSelect('PARKING')
        }}
      >
        <IconBadge icon={<CarIcon size={20} />} tone="primary" size={40} radius="md" />
        <p className="text-h3" aria-hidden="true">
          {t('addRental.optionParking.title')}
        </p>
        <p className={cx('text-body-sm', 'text-muted')}>{t('addRental.optionParking.description')}</p>
      </button>
    </div>
  )
}
