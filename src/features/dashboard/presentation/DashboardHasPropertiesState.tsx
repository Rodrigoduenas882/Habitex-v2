import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Property } from '@/features/properties/domain/property.types'
import { PropertyListCard } from '@/features/properties/presentation/PropertyListCard'
import { cx } from '@/shared/lib/cx'
import buttonStyles from '@/shared/ui/Button.module.css'
import { Card } from '@/shared/ui/Card'
import { IconBadge } from '@/shared/ui/IconBadge'
import { KeyIcon } from '@/shared/ui/icons'
import styles from './DashboardHasPropertiesState.module.css'

export interface DashboardHasPropertiesStateProps {
  /** The signed-in owner's display name (see getDisplayNameFromEmail). */
  name: string | null
  /** Real properties of the active administration (useProperties, already
   * resolved - this component never fetches on its own). */
  properties: Property[]
}

/**
 * Estado B (INC-DASH-01) - real implementation of the approved prototype
 * (src/app/pages/ui-preview/dashboard-redesign/StateHasProperties.tsx): a
 * portfolio summary (count + rentalMode breakdown) and a single real CTA to
 * register the first rental. By definition of this state (at least one
 * property, zero rentals - see useDashboardLifecycleState), every property
 * here is still unrented, so each card's status is always 'available' -
 * never a guess, it follows directly from the state this component is only
 * ever rendered for.
 *
 * Reuses the real PropertyListCard (same component /properties's compact
 * list already uses) instead of re-rendering a parallel card shape - its
 * `unitsOccupancyLabel` is passed as `null` (not "0 de N", which would
 * require occupancy/room data this increment doesn't wire - see this
 * component's PENDING note below).
 *
 * PENDING (reported, not implemented): the approved prototype's summary
 * line also includes a parking count (REDESIGN_PARKING_COUNT). The real
 * data for that would come from `useParkings(administrationId)`
 * (features/parking/application/useParkings.ts), which already exists but
 * isn't wired into this component's props - adding it was out of this
 * increment's explicit scope (DashboardHasPropertiesState only receives
 * `properties`), so the summary line omits the parking count entirely
 * rather than fabricating it.
 */
export function DashboardHasPropertiesState({ name, properties }: DashboardHasPropertiesStateProps) {
  const { t } = useTranslation('dashboard')

  const fullPropertyCount = properties.filter((property) => property.rentalMode === 'FULL_PROPERTY').length
  const byRoomsCount = properties.filter((property) => property.rentalMode === 'BY_ROOMS').length

  const summaryParts = [
    fullPropertyCount > 0 ? t('lifecycle.hasProperties.summaryFullProperty', { count: fullPropertyCount }) : null,
    byRoomsCount > 0 ? t('lifecycle.hasProperties.summaryByRooms', { count: byRoomsCount }) : null,
  ].filter((part): part is string => part !== null)

  return (
    <div className={styles['wrapper']}>
      <header className={styles['header']}>
        <p className={cx('text-caption', styles['eyebrow'])}>
          {name ? t('lifecycle.hasProperties.eyebrowWithName', { name }) : t('lifecycle.hasProperties.eyebrowGeneric')}
        </p>
        <h1 className="text-h1">{t('lifecycle.hasProperties.title')}</h1>
        <p className={cx('text-body', 'text-muted')}>
          {t('lifecycle.hasProperties.subtitle', { count: properties.length })}
        </p>
        {summaryParts.length > 0 ? (
          <p className={cx('text-body-sm', 'text-muted')}>{summaryParts.join(' · ')}</p>
        ) : null}
      </header>

      <div className={styles['grid']}>
        {properties.map((property) => (
          <PropertyListCard key={property.id} property={property} status="available" unitsOccupancyLabel={null} />
        ))}
      </div>

      <Card className={styles['ctaCard']}>
        <IconBadge icon={<KeyIcon size={28} />} tone="primary" size={56} radius="full" />
        <div className={styles['ctaBody']}>
          <p className="text-h3">{t('lifecycle.hasProperties.ctaTitle')}</p>
          <p className={cx('text-body-sm', 'text-muted')}>{t('lifecycle.hasProperties.ctaDescription')}</p>
          <Link
            to="/rentals/new"
            className={cx(buttonStyles['button'], buttonStyles['primary'], buttonStyles['md'], styles['ctaButton'])}
          >
            {t('lifecycle.hasProperties.cta')}
          </Link>
        </div>
      </Card>
    </div>
  )
}
