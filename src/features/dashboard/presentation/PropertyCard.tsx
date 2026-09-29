import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import type { Property } from '@/features/properties/domain/property.types'
import styles from './PropertyCard.module.css'

/** 'unknown' covers the occupancy cross-reference still loading/erroring -
 * see PropertiesOverview's own derivePropertyDisplay doc comment. Rendered
 * as a distinct, honest neutral state rather than guessing 'available'. */
export type PropertyDisplayStatus = 'rented' | 'available' | 'unknown'

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
 * Abstract skyline silhouette used as a placeholder in place of a real
 * property photo - no storage/media integration exists yet. Flat shapes at
 * varying opacity of a single token color, no gradients or imagery.
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
 * Real Property card, decoupled from the mock PropertySummary shape.
 * `location` is composed here from the real Property fields (address, city)
 * since Property has no single pre-formatted location string - `status`/
 * `detail` are computed by the caller (PropertiesOverview), since they
 * depend on occupancy data cross-referenced from other features, not on
 * Property alone.
 */
export function PropertyCard({ property, status, detail }: PropertyCardProps) {
  const { t } = useTranslation('dashboard')
  const location = `${property.address}, ${property.city}`

  return (
    <Card interactive className={styles['card']}>
      <div className={styles['image']}>
        <PropertySkyline />
        <span className={styles['badgeOverlay']}>
          <Badge tone={STATUS_TONE[status]}>{t(STATUS_LABEL_KEY[status])}</Badge>
        </span>
      </div>
      <div className={styles['body']}>
        <p className={styles['name']}>{property.name}</p>
        <p className="text-caption">{location}</p>
        <p className={cx('text-caption', styles['detail'])}>{detail}</p>
      </div>
    </Card>
  )
}
