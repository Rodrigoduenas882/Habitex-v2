import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { IconBadge } from '@/shared/ui/IconBadge'
import { BuildingIcon, CarIcon, KeyIcon } from '@/shared/ui/icons'
import styles from './PropertyTypeSelector.module.css'

export type PropertyAddOption = 'full' | 'rooms'

export interface PropertyTypeSelectorProps {
  onSelect: (option: PropertyAddOption) => void
}

/**
 * "¿Qué quieres administrar?" - a radiogroup of three human-language
 * options. Parking is visible (communicates the future model) but disabled
 * - no ParkingRepository/domain exists yet, so it must not start a flow.
 */
export function PropertyTypeSelector({ onSelect }: PropertyTypeSelectorProps) {
  const { t } = useTranslation('properties')

  return (
    <div role="radiogroup" aria-label={t('addProperty.title')} className={styles['grid']}>
      <button
        type="button"
        role="radio"
        aria-checked={false}
        aria-label={t('addProperty.optionFull.title')}
        className={styles['option']}
        onClick={() => {
          onSelect('full')
        }}
      >
        <IconBadge icon={<BuildingIcon size={20} />} tone="primary" size={40} radius="md" />
        <p className="text-h3" aria-hidden="true">
          {t('addProperty.optionFull.title')}
        </p>
        <p className={cx('text-body-sm', 'text-muted')}>{t('addProperty.optionFull.description')}</p>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={false}
        aria-label={t('addProperty.optionRooms.title')}
        className={styles['option']}
        onClick={() => {
          onSelect('rooms')
        }}
      >
        <IconBadge icon={<KeyIcon size={20} />} tone="primary" size={40} radius="md" />
        <p className="text-h3" aria-hidden="true">
          {t('addProperty.optionRooms.title')}
        </p>
        <p className={cx('text-body-sm', 'text-muted')}>{t('addProperty.optionRooms.description')}</p>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={false}
        disabled
        aria-label={`${t('addProperty.optionParking.title')} - ${t('addProperty.optionParking.comingSoon')}`}
        className={cx(styles['option'], styles['optionDisabled'])}
      >
        <IconBadge icon={<CarIcon size={20} />} tone="neutral" size={40} radius="md" />
        <p className="text-h3">{t('addProperty.optionParking.title')}</p>
        <p className={cx('text-body-sm', 'text-muted')}>{t('addProperty.optionParking.description')}</p>
        <span className={styles['comingSoon']}>{t('addProperty.optionParking.comingSoon')}</span>
      </button>
    </div>
  )
}
