import { useTranslation } from 'react-i18next'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
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
 * Same visual family as PropertyListCard (Card, same spacing/typography
 * tokens, same tone="neutral" badges for descriptive attributes) but not a
 * copy - Parking has no photo placeholder and a genuinely different set of
 * fields, so forcing it through PropertyListCard's layout would mean
 * conditions for fields that don't apply to properties.
 */
export function ParkingListCard({ parking, associatedPropertyName }: ParkingListCardProps) {
  const { t } = useTranslation('parking')

  return (
    <Card className={styles['card']}>
      <p className={styles['identifier']}>{parking.identifier}</p>
      {parking.location ? <p className="text-caption text-muted">{parking.location}</p> : null}
      {associatedPropertyName ? (
        <p className="text-caption text-muted">
          {t('list.associatedWith', { name: associatedPropertyName })}
        </p>
      ) : null}
      <div className={styles['meta']}>
        {parking.allowedVehicleType ? (
          <Badge tone="neutral">{t(`form.vehicleType.${parking.allowedVehicleType}`)}</Badge>
        ) : null}
        {parking.covered !== null ? (
          <Badge tone="neutral">{t(parking.covered ? 'list.covered.yes' : 'list.covered.no')}</Badge>
        ) : null}
      </div>
    </Card>
  )
}
