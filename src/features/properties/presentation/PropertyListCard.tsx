import { useTranslation } from 'react-i18next'
import type { PropertyOccupancyStatus } from '@/features/properties/application/usePropertyOccupancy'
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
  /** "X de Y unidades ocupadas" (see deriveUnitsAndOccupancy /
   * derivePropertyListDisplay) - `null` while occupancy isn't ready yet, in
   * which case the line is simply omitted instead of guessed. */
  unitsOccupancyLabel: string | null
}

/**
 * The compact card used below the 1024px breakpoint (the approved Figma
 * candidate's "tarjetas compactas en móvil", docs/DESIGN.md §15 - the
 * desktop breakpoint uses PropertiesPage's own table instead). A single
 * inline icon identity row, not a 120px photo-style header - that larger
 * header language is the Dashboard carousel's own card, not this list's.
 * Shows modalidad (the rentalMode badge, always known) and units/occupancy
 * (only when known) without losing this compact shape or overflowing.
 */
export function PropertyListCard({ property, status, unitsOccupancyLabel }: PropertyListCardProps) {
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
      {unitsOccupancyLabel ? <p className="text-caption text-muted">{unitsOccupancyLabel}</p> : null}
      <div className={styles['meta']}>
        <Badge tone="neutral">{t(`propertyType.${property.propertyType}`)}</Badge>
        <Badge tone="neutral">{t(`rentalMode.${property.rentalMode}`)}</Badge>
      </div>
    </Card>
  )
}
