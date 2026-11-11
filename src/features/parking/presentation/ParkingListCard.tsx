import { useTranslation } from 'react-i18next'
import { Badge } from '@/shared/ui/Badge'
import { CarIcon } from '@/shared/ui/icons'
import { IconBadge } from '@/shared/ui/IconBadge'
import type { Parking } from '../domain/parking.types'
import styles from './ParkingListCard.module.css'

export interface ParkingListCardProps {
  parking: Parking
  /**
   * The associated Property's name, already resolved by the caller against
   * the real Properties list - null when independent, or when the
   * association can't be shown yet (Properties still loading/errored, or
   * the match isn't in the list). Never looked up here, never a fallback
   * id/placeholder.
   */
  associatedPropertyName: string | null
}

/**
 * One compact row - the approved Figma candidate's "filas compactas para
 * parqueaderos" (a single pattern at every width, unlike Properties which
 * switches between a desktop table and a mobile card). Not a `Card` of its
 * own: PropertiesPage renders a list of these inside one shared bordered
 * container, the row itself is just content + a bottom divider (see
 * PropertiesPage.module.css's `.parkingList`).
 */
export function ParkingListCard({ parking, associatedPropertyName }: ParkingListCardProps) {
  const { t } = useTranslation('parking')

  return (
    <div className={styles['row']}>
      <IconBadge icon={<CarIcon size={16} />} tone="neutral" size={32} radius="md" />
      <div className={styles['identity']}>
        <p className={styles['identifier']}>{parking.identifier}</p>
        {parking.location ? <p className="text-caption text-muted">{parking.location}</p> : null}
        {associatedPropertyName ? (
          <p className="text-caption text-muted">{t('list.associatedWith', { name: associatedPropertyName })}</p>
        ) : null}
      </div>
      <div className={styles['meta']}>
        {parking.allowedVehicleType ? (
          <Badge tone="neutral">{t(`form.vehicleType.${parking.allowedVehicleType}`)}</Badge>
        ) : null}
        {parking.covered !== null ? (
          <Badge tone="neutral">{t(parking.covered ? 'list.covered.yes' : 'list.covered.no')}</Badge>
        ) : null}
      </div>
    </div>
  )
}
