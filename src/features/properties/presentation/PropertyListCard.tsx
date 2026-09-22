import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import type { Property } from '../domain/property.types'
import styles from './PropertyListCard.module.css'

export interface PropertyListCardProps {
  property: Property
}

/**
 * Same visual placeholder language as the Dashboard's PropertyCard (an
 * abstract skyline silhouette, no real photo/Storage integration yet) -
 * duplicated locally rather than imported cross-feature from
 * dashboard/presentation, which stays untouched this increment. A shared
 * shared/ui/PropertySkyline is a reasonable dedupe candidate later.
 */
function PropertySkyline() {
  return (
    <svg
      className={styles['skyline']}
      viewBox="0 0 240 120"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect x="14" y="74" width="28" height="46" opacity="0.85" />
      <rect x="48" y="52" width="34" height="68" opacity="0.5" />
      <rect x="88" y="82" width="24" height="38" opacity="0.35" />
      <rect x="118" y="36" width="40" height="84" opacity="1" />
      <rect x="164" y="66" width="30" height="54" opacity="0.5" />
      <rect x="200" y="78" width="26" height="42" opacity="0.3" />
    </svg>
  )
}

/**
 * Real property card - decoupled from the Dashboard's mock PropertySummary.
 * Only shows fields the properties table actually has; no rented/available
 * badge, because occupancy isn't known here (see Property's own doc comment).
 */
export function PropertyListCard({ property }: PropertyListCardProps) {
  const { t } = useTranslation('properties')

  return (
    <Card className={styles['card']}>
      <div className={styles['image']}>
        <PropertySkyline />
      </div>
      <div className={styles['body']}>
        <p className={styles['name']}>{property.name}</p>
        <p className="text-caption">{property.city}</p>
        <p className={cx('text-caption', styles['detail'])}>{property.address}</p>
        <div className={styles['meta']}>
          <Badge tone="neutral">{t(`propertyType.${property.propertyType}`)}</Badge>
          <Badge tone="neutral">{t(`rentalMode.${property.rentalMode}`)}</Badge>
        </div>
      </div>
    </Card>
  )
}
