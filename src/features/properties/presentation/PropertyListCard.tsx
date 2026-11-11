import { useTranslation } from 'react-i18next'
import type { PropertyOccupancyStatus } from '@/features/properties/application/usePropertyOccupancy'
import { cx } from '@/shared/lib/cx'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import { BuildingIcon, HomeIcon } from '@/shared/ui/icons'
import { IconBadge } from '@/shared/ui/IconBadge'
import type { Property } from '../domain/property.types'
import { PROPERTY_STATUS_LABEL_KEY, PROPERTY_STATUS_TONE } from './derivePropertyListDisplay'
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

/**
 * The compact card used below the 1024px breakpoint (the approved Figma
 * candidate's "tarjetas compactas en móvil" - the desktop breakpoint uses
 * PropertiesPage's own table instead, see its PropertyTable section). A
 * single inline icon identity row, not a 120px photo-style header - that
 * larger header language is the Dashboard carousel's own card, not this
 * list's. status/detail are computed once by usePropertyOccupancy +
 * derivePropertyOccupancyStatus, never re-derived here (see that hook's own
 * doc comment).
 */
export function PropertyListCard({ property, status, detail }: PropertyListCardProps) {
  const { t } = useTranslation('properties')
  const PropertyIcon = property.propertyType === 'HOUSE' ? HomeIcon : BuildingIcon

  return (
    <Card className={styles['card']}>
      <div className={styles['header']}>
        <IconBadge icon={<PropertyIcon size={18} />} tone="neutral" size={36} radius="md" />
        <div className={styles['identity']}>
          <p className={styles['name']}>{property.name}</p>
          <p className="text-caption">{property.city}</p>
          <p className="text-caption text-muted">{property.address}</p>
        </div>
        <Badge tone={PROPERTY_STATUS_TONE[status]}>{t(PROPERTY_STATUS_LABEL_KEY[status])}</Badge>
      </div>
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
    </Card>
  )
}
