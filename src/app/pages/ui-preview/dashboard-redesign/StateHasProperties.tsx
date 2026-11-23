import { cx } from '@/shared/lib/cx'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
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
 *
 * Iteration (Parte 2, 2026-11):
 * - Property cards no longer use the shared `<Card>` primitive, to avoid a
 *   CSS-module specificity fight over which stylesheet's `.card` class wins
 *   (see tokens.css's own comment on why this prototype needs dedicated
 *   tokens in the first place). `.card` below replicates Card's own shape
 *   (radius-lg/shadow-sm) but reads its surface from the
 *   --dashboard-redesign-card-* tokens instead of --color-surface/-border.
 * - Replaced the tall icon-only "image" block (a large, content-less block
 *   that read as a dark empty slab in Dark theme) with a horizontal header
 *   row: a smaller IconBadge next to the property name, availability Badge
 *   on the same row. All the property's real info (name, address, city,
 *   rental mode) is still shown, just denser and with more text alongside
 *   the icon instead of below a big empty block.
 * - The "Registra tu primer arriendo" CTA follows the same pattern as
 *   StateNewOwner's: a plain (non-interactive) card carrying the icon/copy,
 *   plus an explicit `Button` (`variant="primary"`) as the one unambiguous
 *   action - clearer than a whole clickable card, and avoids nesting a
 *   <button> inside a <button>.
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
            <div key={property.id} className={styles['card']}>
              <div className={styles['cardTop']}>
                <IconBadge icon={<PropertyIcon size={20} />} tone="neutral" size={40} radius="md" />
                <p className={cx('text-h3', styles['cardName'])}>{property.name}</p>
                <Badge tone="info" className={styles['cardBadge']}>
                  Disponible
                </Badge>
              </div>
              <div className={styles['cardBody']}>
                <p className="text-caption text-muted">
                  {property.address}, {property.city}
                </p>
                <p className="text-caption text-muted">{RENTAL_MODE_LABEL[property.rentalMode]}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className={styles['ctaCard']}>
        <IconBadge icon={<KeyIcon size={28} />} tone="primary" size={56} radius="full" />
        <div className={styles['ctaBody']}>
          <p className="text-h3">Registra tu primer arriendo</p>
          <p className={cx('text-body-sm', 'text-muted')}>
            Asocia un arrendatario a uno de tus inmuebles para empezar a llevar el control de pagos.
          </p>
          <Button variant="primary" className={styles['ctaButton']} onClick={() => {}}>
            Registrar arriendo
          </Button>
        </div>
      </div>
    </div>
  )
}
