import { cx } from '@/shared/lib/cx'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import { IconBadge } from '@/shared/ui/IconBadge'
import { BuildingIcon, HomeIcon, KeyIcon } from '@/shared/ui/icons'
import {
  REDESIGN_OWNER_NAME,
  REDESIGN_PARKING_COUNT,
  REDESIGN_PROPERTIES,
  type RedesignRentalMode,
} from './dashboard-redesign-mock-data'
import styles from './StateHasProperties.module.css'

const RENTAL_MODE_LABEL: Record<RedesignRentalMode, string> = {
  FULL_PROPERTY: 'Arriendo completo',
  BY_ROOMS: 'Por habitaciones',
}

/**
 * Estado B - con inmuebles, sin arriendos. A useful portfolio summary (count
 * + type breakdown, docs/DESIGN.md's property-type/rental-mode vocabulary)
 * and one primary action ("Registra tu primer arriendo"). Deliberately no
 * financial KPIs and no AttentionPanel-style section: no arriendo exists yet,
 * so there is no real content either would show - see the Parte 1 brief.
 */
export function StateHasProperties() {
  const fullPropertyCount = REDESIGN_PROPERTIES.filter((property) => property.rentalMode === 'FULL_PROPERTY').length
  const byRoomsCount = REDESIGN_PROPERTIES.filter((property) => property.rentalMode === 'BY_ROOMS').length

  const summaryParts = [
    fullPropertyCount > 0
      ? `${String(fullPropertyCount)} ${fullPropertyCount === 1 ? 'arriendo completo' : 'arriendos completos'}`
      : null,
    byRoomsCount > 0 ? `${String(byRoomsCount)} por habitaciones` : null,
    REDESIGN_PARKING_COUNT > 0
      ? `${String(REDESIGN_PARKING_COUNT)} ${REDESIGN_PARKING_COUNT === 1 ? 'parqueadero' : 'parqueaderos'}`
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')

  return (
    <div className={styles['wrapper']}>
      <header className={styles['header']}>
        <p className={cx('text-caption', styles['eyebrow'])}>Hola, {REDESIGN_OWNER_NAME}</p>
        <h1 className="text-h1">Tu portafolio</h1>
        <p className={cx('text-body', 'text-muted')}>
          Tienes {REDESIGN_PROPERTIES.length} inmuebles registrados. Todavía no tienes arriendos activos.
        </p>
        <p className={cx('text-body-sm', 'text-muted')}>{summaryParts}</p>
      </header>

      <div className={styles['grid']}>
        {REDESIGN_PROPERTIES.map((property) => {
          const PropertyIcon = property.propertyType === 'HOUSE' ? HomeIcon : BuildingIcon
          return (
            <Card key={property.id} className={styles['card']}>
              <div className={styles['cardImage']}>
                <IconBadge icon={<PropertyIcon size={24} />} tone="neutral" size={48} radius="md" />
                <span className={styles['badgeOverlay']}>
                  <Badge tone="info">Disponible</Badge>
                </span>
              </div>
              <div className={styles['cardBody']}>
                <p className={styles['cardName']}>{property.name}</p>
                <p className="text-caption text-muted">
                  {property.address}, {property.city}
                </p>
                <p className="text-caption text-muted">{RENTAL_MODE_LABEL[property.rentalMode]}</p>
              </div>
            </Card>
          )
        })}
      </div>

      <button type="button" className={styles['ctaCard']} onClick={() => {}}>
        <IconBadge
          icon={<KeyIcon size={28} />}
          tone="primary"
          size={56}
          radius="full"
          className={styles['ctaIcon']}
        />
        <div className={styles['ctaBody']}>
          <p className="text-h3">Registra tu primer arriendo</p>
          <p className={cx('text-body-sm', 'text-muted')}>
            Asocia un arrendatario a uno de tus inmuebles para empezar a llevar el control de pagos.
          </p>
        </div>
      </button>
    </div>
  )
}
