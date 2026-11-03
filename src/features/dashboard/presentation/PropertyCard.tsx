import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { BuildingIcon, HomeIcon } from '@/shared/ui/icons'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import type { Property } from '@/features/properties/domain/property.types'
import type { PropertyOccupancyStatus } from '@/features/properties/application/usePropertyOccupancy'
import styles from './PropertyCard.module.css'

/** Alias of the shared `PropertyOccupancyStatus` (see
 * `properties/application/usePropertyOccupancy`'s own doc comment) - that
 * is the single source of truth for "is this Property occupied"; this
 * local name is kept only so this file's existing Dashboard-scoped usages
 * don't all need renaming. */
export type PropertyDisplayStatus = PropertyOccupancyStatus

export interface PropertyCardProps {
  property: Property
  status: PropertyDisplayStatus
  /** One short, real, already-translated secondary line - see PropertiesOverview. */
  detail: string
}

const STATUS_TONE: Record<PropertyDisplayStatus, BadgeTone> = {
  rented: 'success',
  available: 'info',
  unknown: 'neutral',
}

const STATUS_LABEL_KEY: Record<
  PropertyDisplayStatus,
  'properties.rented' | 'properties.available' | 'properties.statusUnknown'
> = {
  rented: 'properties.rented',
  available: 'properties.available',
  unknown: 'properties.statusUnknown',
}

/**
 * Real Property card, decoupled from the mock PropertySummary shape.
 * `location` is composed here from the real Property fields (address, city)
 * since Property has no single pre-formatted location string - `status`/
 * `detail` are computed by the caller (PropertiesOverview), since they
 * depend on occupancy data cross-referenced from other features, not on
 * Property alone.
 */
export function PropertyCard({ property, status, detail }: PropertyCardProps) {
  const { t } = useTranslation('dashboard')
  const { t: propertyT } = useTranslation('properties')
  const PropertyIcon = property.propertyType === 'HOUSE' ? HomeIcon : BuildingIcon
  const location = `${property.address}, ${property.city}`

  return (
    <Card className={styles['card']}>
      <div className={styles['image']}>
        <div className={styles['propertyType']}><PropertyIcon size={40} aria-hidden="true" /></div>
        <span className={styles['badgeOverlay']}>
          <Badge tone={STATUS_TONE[status]}>{t(STATUS_LABEL_KEY[status])}</Badge>
        </span>
      </div>
      <div className={styles['body']}>
        <p className={styles['name']}>{property.name}</p>
        <p className="text-caption">{location}</p>
        {property.rentalMode === 'BY_ROOMS' ? <p className="text-caption">{propertyT(property.propertyType === 'HOUSE' ? 'propertyType.HOUSE' : 'propertyType.APARTMENT')}</p> : null}
        <p className={cx('text-caption', styles['detail'])}>{detail}</p>
      </div>
    </Card>
  )
}
