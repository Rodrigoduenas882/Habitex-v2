import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useCurrentAdministration } from '@/features/administration/application/useCurrentAdministration'
import { useParkings } from '@/features/parking/application/useParkings'
import type { Parking } from '@/features/parking/domain/parking.types'
import { ParkingListCard } from '@/features/parking/presentation/ParkingListCard'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { BuildingIcon, CarIcon } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'
import styles from './PropertiesPage.module.css'
import { PropertyListCard } from './PropertyListCard'
import { useProperties } from '../application/useProperties'
import type { Property } from '../domain/property.types'

function GridSkeleton({ testId }: { testId: string }) {
  return (
    <div className={styles['grid']} data-testid={testId} aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} height={196} radius="lg" />
      ))}
    </div>
  )
}

interface PropertiesSectionProps {
  query: UseQueryResult<Property[]>
}

function PropertiesSection({ query }: PropertiesSectionProps) {
  const { t } = useTranslation('properties')

  if (query.isLoading) {
    return <GridSkeleton testId="properties-loading" />
  }

  if (query.isError) {
    return (
      <Alert tone="danger" title={t('errors.propertiesTitle')}>
        {t('errors.propertiesDescription')}
      </Alert>
    )
  }

  const properties = query.data ?? []

  if (properties.length === 0) {
    return (
      <EmptyState
        icon={<BuildingIcon size={24} />}
        title={t('empty.title')}
        description={t('empty.description')}
      />
    )
  }

  return (
    <div className={styles['grid']}>
      {properties.map((property) => (
        <PropertyListCard key={property.id} property={property} />
      ))}
    </div>
  )
}

interface ParkingsSectionProps {
  query: UseQueryResult<Parking[]>
  propertiesQuery: UseQueryResult<Property[]>
  emptyAction: ReactNode
}

function ParkingsSection({ query, propertiesQuery, emptyAction }: ParkingsSectionProps) {
  const { t } = useTranslation('parking')

  if (query.isLoading) {
    return <GridSkeleton testId="parkings-loading" />
  }

  if (query.isError) {
    return <Alert tone="danger">{t('section.errors.listFailed')}</Alert>
  }

  const parkings = query.data ?? []

  if (parkings.length === 0) {
    return (
      <EmptyState
        icon={<CarIcon size={24} />}
        title={t('section.empty.title')}
        description={t('section.empty.description')}
        action={emptyAction}
      />
    )
  }

  // Cross-referenced against the real, already-loaded Properties list - no
  // extra query. If Properties hasn't resolved successfully yet (still
  // loading, or errored), the association is omitted rather than guessed.
  const properties = propertiesQuery.isSuccess ? propertiesQuery.data : null

  return (
    <div className={styles['grid']}>
      {parkings.map((parking) => {
        const associatedPropertyName =
          parking.propertyId && properties
            ? (properties.find((property) => property.id === parking.propertyId)?.name ?? null)
            : null

        return (
          <ParkingListCard
            key={parking.id}
            parking={parking}
            associatedPropertyName={associatedPropertyName}
          />
        )
      })}
    </div>
  )
}

/**
 * /properties: Propiedades + Parqueaderos as two independent, stacked
 * sections (never a shared status - one source failing/loading never
 * blocks the other). Administration Context gating still governs the whole
 * page, same as before.
 */
export default function PropertiesPage() {
  const { t } = useTranslation(['properties', 'parking'])
  const navigate = useNavigate()
  const currentAdministration = useCurrentAdministration()
  const administrationId =
    currentAdministration.status === 'resolved' ? currentAdministration.administration.id : undefined
  const propertiesQuery = useProperties(administrationId)
  const parkingsQuery = useParkings(administrationId)

  const addPropertyCta = (
    <Button
      onClick={() => {
        void navigate('/properties/new')
      }}
    >
      {t('addProperty.cta')}
    </Button>
  )

  let gateContent: ReactNode = null

  if (currentAdministration.status === 'loading') {
    gateContent = <GridSkeleton testId="properties-loading" />
  } else if (currentAdministration.status === 'error') {
    gateContent = (
      <Alert tone="danger" title={t('errors.administrationTitle')}>
        {t('errors.administrationDescription')}
      </Alert>
    )
  } else if (currentAdministration.status === 'none') {
    gateContent = (
      <EmptyState
        icon={<BuildingIcon size={24} />}
        title={t('noAdministration.title')}
        description={t('noAdministration.description')}
      />
    )
  } else if (currentAdministration.status === 'selection-required') {
    gateContent = (
      <EmptyState
        icon={<BuildingIcon size={24} />}
        title={t('selectionRequired.title')}
        description={t('selectionRequired.description')}
      />
    )
  }

  return (
    <div className={styles['page']}>
      <div className={styles['header']}>
        <h1 className="text-h2">{t('title')}</h1>
        {currentAdministration.status === 'resolved' ? addPropertyCta : null}
      </div>

      {gateContent ?? (
        <>
          <section className={styles['section']}>
            <h2 className="text-h3">{t('sections.properties')}</h2>
            <PropertiesSection query={propertiesQuery} />
          </section>

          <section className={styles['section']}>
            <h2 className="text-h3">{t('parking:section.title')}</h2>
            <ParkingsSection
              query={parkingsQuery}
              propertiesQuery={propertiesQuery}
              emptyAction={addPropertyCta}
            />
          </section>
        </>
      )}
    </div>
  )
}
