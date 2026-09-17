import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import styles from './PropertyCard.module.css'
import type { PropertySummary } from './dashboard-mock-data'

export interface PropertyCardProps {
  property: PropertySummary
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

export function PropertyCard({ property }: PropertyCardProps) {
  const { t } = useTranslation('dashboard')
  const isRented = property.status === 'rented'

  return (
    <Card interactive className={styles['card']}>
      <div className={styles['image']}>
        <PropertySkyline />
        <span className={styles['badgeOverlay']}>
          <Badge tone={isRented ? 'success' : 'info'}>
            {t(isRented ? 'properties.rented' : 'properties.available')}
          </Badge>
        </span>
      </div>
      <div className={styles['body']}>
        <p className={styles['name']}>{property.name}</p>
        <p className="text-caption">{property.location}</p>
        <p className={cx('text-caption', styles['detail'])}>{property.detail}</p>
      </div>
    </Card>
  )
}
