import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Parking } from '@/features/parking/domain/parking.types'
import { ParkingListCard } from '@/features/parking/presentation/ParkingListCard'
import { derivePropertyListDisplay } from '@/features/properties/presentation/derivePropertyListDisplay'
import { PropertyListCard } from '@/features/properties/presentation/PropertyListCard'
import type { PropertyOccupancyMap } from '@/features/properties/application/usePropertyOccupancy'
import type { Property } from '@/features/properties/domain/property.types'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { BuildingIcon, CarIcon } from '@/shared/ui/icons'
import { AppShellPreview } from './AppShellPreview'
import styles from './PropertiesVisualPreview.module.css'

// Design fixtures only. Never consumed by the authenticated /properties route.
const properties: Property[] = [
  { id: 'demo-prop-1', administrationId: 'demo', propertyType: 'APARTMENT', rentalMode: 'FULL_PROPERTY', name: 'Apartamento 302', countryCode: 'CO', city: 'Bogotá', address: 'Carrera 7 # 72-35', hasAdministration: true, administrationFee: 180000 },
  { id: 'demo-prop-2', administrationId: 'demo', propertyType: 'HOUSE', rentalMode: 'FULL_PROPERTY', name: 'Casa 14', countryCode: 'CO', city: 'Medellín', address: 'Calle 10 # 43-21', hasAdministration: false, administrationFee: null },
  { id: 'demo-prop-3', administrationId: 'demo', propertyType: 'APARTMENT', rentalMode: 'BY_ROOMS', name: 'Apartamento 501', countryCode: 'CO', city: 'Bogotá', address: 'Calle 85 # 12-18', hasAdministration: true, administrationFee: 220000 },
  { id: 'demo-prop-4', administrationId: 'demo', propertyType: 'HOUSE', rentalMode: 'BY_ROOMS', name: 'Casa 22', countryCode: 'CO', city: 'Cali', address: 'Avenida 6N # 28-14', hasAdministration: false, administrationFee: null },
]

const occupancy: PropertyOccupancyMap = {
  status: 'ready',
  byPropertyId: new Map([
    ['demo-prop-1', { isOccupied: true, occupiedRooms: 0, totalRooms: 0 }],
    ['demo-prop-3', { isOccupied: false, occupiedRooms: 2, totalRooms: 3 }],
    ['demo-prop-4', { isOccupied: false, occupiedRooms: 0, totalRooms: 2 }],
  ]),
}

const parkings: Parking[] = [
  { id: 'demo-parking-1', administrationId: 'demo', propertyId: null, identifier: 'Parqueadero 12', location: 'Sótano 1', covered: true, allowedVehicleType: 'CAR' },
  { id: 'demo-parking-2', administrationId: 'demo', propertyId: 'demo-prop-1', identifier: 'P-07', location: null, covered: false, allowedVehicleType: 'MOTORCYCLE' },
  { id: 'demo-parking-3', administrationId: 'demo', propertyId: null, identifier: 'Sótano 3', location: null, covered: null, allowedVehicleType: 'BOTH' },
]

/**
 * Visual-only preview of the real /properties list cards (PropertyListCard,
 * ParkingListCard) through mock fixtures - same technique as
 * DashboardVisualPreview, reached the same way (`/ui-preview?view=properties`).
 * Deliberately NOT gated behind `import.meta.env.DEV` like
 * DashboardVisualPreview is - this one needs to stay reachable from the
 * production-style build so Playwright (and an independent reviewer) can
 * exercise it without a real Supabase session, which neither can obtain
 * against the real authenticated route.
 *
 * Renders the real list cards and the real derivePropertyListDisplay/
 * usePropertyOccupancy shapes (not a re-implementation) so this preview
 * can't visually drift from what /properties actually renders. Search/
 * filter *behavior* is already covered by PropertiesPage.test.tsx against
 * the real page - this preview exists for visual/responsive/light-dark
 * review of the cards and grid, not to re-verify that logic.
 */
export default function PropertiesVisualPreview() {
  const { t } = useTranslation('properties')
  const { t: parkingT } = useTranslation('parking')
  const [empty, setEmpty] = useState(false)

  return (
    <AppShellPreview fullViewport>
      <div className={styles['notice']}>
        <Alert tone="info" title="Vista de demostración · Inmuebles y Parqueaderos">
          Todos los inmuebles y parqueaderos de esta vista son ficticios. Las acciones de navegación llevan a
          rutas reales que requieren sesión.
        </Alert>
        <Button
          variant="secondary"
          size="sm"
          aria-pressed={empty}
          onClick={() => {
            setEmpty(!empty)
          }}
        >
          {empty ? 'Ver datos de demostración' : 'Ver estados vacíos'}
        </Button>
      </div>

      <div className={styles['page']}>
        <div className={styles['header']}>
          <h1 className="text-h2">{t('title')}</h1>
        </div>

        <section className={styles['section']}>
          <h2 className="text-h3">{t('sections.properties')}</h2>
          {empty ? (
            <EmptyState icon={<BuildingIcon size={24} />} title={t('empty.title')} description={t('empty.description')} />
          ) : (
            <div className={styles['grid']}>
              {properties.map((property) => {
                const { status, detail } = derivePropertyListDisplay(property, occupancy, t)
                return <PropertyListCard key={property.id} property={property} status={status} detail={detail} />
              })}
            </div>
          )}
        </section>

        <section className={styles['section']}>
          <h2 className="text-h3">{parkingT('section.title')}</h2>
          {empty ? (
            <EmptyState
              icon={<CarIcon size={24} />}
              title={parkingT('section.empty.title')}
              description={parkingT('section.empty.description')}
            />
          ) : (
            <div className={styles['grid']}>
              {parkings.map((parking) => {
                const associatedPropertyName =
                  parking.propertyId != null
                    ? (properties.find((property) => property.id === parking.propertyId)?.name ?? null)
                    : null
                return (
                  <ParkingListCard key={parking.id} parking={parking} associatedPropertyName={associatedPropertyName} />
                )
              })}
            </div>
          )}
        </section>
      </div>
    </AppShellPreview>
  )
}
