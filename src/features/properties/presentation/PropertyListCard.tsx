import { useTranslation } from 'react-i18next'
import type { PropertyOccupancyStatus } from '@/features/properties/application/usePropertyOccupancy'
import { cx } from '@/shared/lib/cx'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import { BuildingIcon, HomeIcon } from '@/shared/ui/icons'
import type { Property } from '../domain/property.types'
import styles from './PropertyListCard.module.css'

export interface PropertyListCardProps {
  property: Property
  /** Shared occupancy computation (see usePropertyOccupancy's own doc
   * comment) - this card never re-derives it on its own. */
  status: PropertyOccupancyStatus
  /** One short, already-translated secondary line - computed by the caller
   * (PropertiesPage), same pattern as the Dashboard's PropertyCard. */
  detail: string
}

const STATUS_TONE: Record<PropertyOccupancyStatus, BadgeTone> = {
  rented: 'success',
  available: 'info',
  unknown: 'neutral',
}

const STATUS_LABEL_KEY: Record<
  PropertyOccupancyStatus,
  'occupancy.rented' | 'occupancy.available' | 'occupancy.statusUnknown'
> = {
  rented: 'occupancy.rented',
  available: 'occupancy.available',
  unknown: 'occupancy.statusUnknown',
}

/**
 * Real property card - decoupled from the Dashboard's mock PropertySummary.
 * Now shares both the same occupancy badge AND the same placeholder
 * language (propertyType icon + overlaid status badge) as the Dashboard's
 * PropertyCard - status/detail are computed once by usePropertyOccupancy +
 * derivePropertyOccupancyStatus, never re-derived here (see that hook's own
 * doc comment); the icon-based placeholder is duplicated locally rather
 * than imported cross-feature from dashboard/presentation, which stays
 * untouched this increment. A shared shared/ui/PropertyPlaceholder is a
 * reasonable dedupe candidate later.
 */
export function PropertyListCard({ property, status, detail }: PropertyListCardProps) {
  const { t } = useTranslation('properties')
  const PropertyIcon = property.propertyType === 'HOUSE' ? HomeIcon : BuildingIcon

  return (
    <Card className={styles['card']}>
      <div className={styles['image']}>
        <PropertyIcon size={40} aria-hidden="true" className={styles['propertyIcon']} />
        <span className={styles['badgeOverlay']}>
          <Badge tone={STATUS_TONE[status]}>{t(STATUS_LABEL_KEY[status])}</Badge>
        </span>
      </div>
      <div className={styles['body']}>
        <p className={styles['name']}>{property.name}</p>
        <p className="text-caption">{property.city}</p>
        <p className={cx('text-caption', styles['detail'])}>{property.address}</p>
        {/* BY_ROOMS only - for FULL_PROPERTY, `detail` is the same text the
            propertyType badge below already shows, so rendering it again
            here would just be a literal duplicate line. */}
        {property.rentalMode === 'BY_ROOMS' ? (
          <p className={cx('text-caption', 'text-muted')}>{detail}</p>
        ) : null}
        <div className={styles['meta']}>
          <Badge tone="neutral">{t(`propertyType.${property.propertyType}`)}</Badge>
          <Badge tone="neutral">{t(`rentalMode.${property.rentalMode}`)}</Badge>
        </div>
      </div>
    </Card>
  )
}
