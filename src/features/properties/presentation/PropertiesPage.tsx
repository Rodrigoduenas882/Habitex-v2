import { useState, type ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { useTranslation, type UseTranslationResponse } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useActiveAdministration } from '@/features/administration/application/useActiveAdministration'
import { AdministrationPicker } from '@/features/administration/presentation/AdministrationPicker'
import { useParkings } from '@/features/parking/application/useParkings'
import type { Parking } from '@/features/parking/domain/parking.types'
import { ParkingListCard } from '@/features/parking/presentation/ParkingListCard'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { BuildingIcon, CarIcon } from '@/shared/ui/icons'
import { Input } from '@/shared/ui/Input'
import { Skeleton } from '@/shared/ui/Skeleton'
import styles from './PropertiesPage.module.css'
import { PropertyListCard } from './PropertyListCard'
import { useProperties } from '../application/useProperties'
import {
  derivePropertyOccupancyStatus,
  usePropertyOccupancy,
  type PropertyOccupancyMap,
} from '../application/usePropertyOccupancy'
import type { Property } from '../domain/property.types'

type PropertiesSectionT = UseTranslationResponse<'properties', undefined>['t']

/** Lowercase + diacritic-stripped, so "bogota" matches "Bogotá" - a single
 * local helper shared by both sections below, not a new shared/ui primitive
 * (this is search-matching logic, not a UI component). */
function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function matchesSearch(term: string, ...fields: Array<string | null>): boolean {
  const needle = normalizeForSearch(term.trim())
  if (!needle) return true
  return fields.some((field) => field != null && normalizeForSearch(field).includes(needle))
}

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
  occupancy: PropertyOccupancyMap
  searchTerm: string
}

/**
 * This section's own i18n-formatted detail string, built from the shared,
 * pure derivePropertyOccupancyStatus (see usePropertyOccupancy's own doc
 * comment) - the status computation itself is never re-derived here, only
 * formatted into this feature's own copy (properties.json's `occupancy`
 * keys, not dashboard.json's).
 */
function derivePropertyListDisplay(
  property: Property,
  occupancy: PropertyOccupancyMap,
  t: PropertiesSectionT,
): { status: ReturnType<typeof derivePropertyOccupancyStatus>['status']; detail: string } {
  const { status, occupiedRooms, totalRooms } = derivePropertyOccupancyStatus(property, occupancy)

  if (property.rentalMode === 'FULL_PROPERTY') {
    return { status, detail: t(`propertyType.${property.propertyType}`) }
  }

  if (occupancy.status !== 'ready') {
    return { status, detail: t('rentalMode.BY_ROOMS') }
  }

  return { status, detail: t('occupancy.roomsDetail', { occupied: occupiedRooms, total: totalRooms }) }
}

function PropertiesSection({ query, occupancy, searchTerm }: PropertiesSectionProps) {
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

  const visible = properties.filter((property) =>
    matchesSearch(searchTerm, property.name, property.address, property.city),
  )

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={<BuildingIcon size={24} />}
        title={t('search.noResults.title', { query: searchTerm })}
        description={t('search.noResults.description', { query: searchTerm })}
      />
    )
  }

  return (
    <div className={styles['grid']}>
      {visible.map((property) => {
        const { status, detail } = derivePropertyListDisplay(property, occupancy, t)
        return <PropertyListCard key={property.id} property={property} status={status} detail={detail} />
      })}
    </div>
  )
}

interface ParkingsSectionProps {
  query: UseQueryResult<Parking[]>
  propertiesQuery: UseQueryResult<Property[]>
  emptyAction: ReactNode
  searchTerm: string
}

function ParkingsSection({ query, propertiesQuery, emptyAction, searchTerm }: ParkingsSectionProps) {
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

  const visible = parkings.filter((parking) => matchesSearch(searchTerm, parking.identifier, parking.location))

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={<CarIcon size={24} />}
        title={t('section.search.noResults.title', { query: searchTerm })}
        description={t('section.search.noResults.description', { query: searchTerm })}
      />
    )
  }

  return (
    <div className={styles['grid']}>
      {visible.map((parking) => {
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
  const currentAdministration = useActiveAdministration()
  const administrationId =
    currentAdministration.status === 'resolved' ? currentAdministration.administration.id : undefined
  const propertiesQuery = useProperties(administrationId)
  const parkingsQuery = useParkings(administrationId)
  const propertyOccupancy = usePropertyOccupancy(administrationId)
  const [propertySearch, setPropertySearch] = useState('')
  const [parkingSearch, setParkingSearch] = useState('')

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
      <AdministrationPicker
        options={currentAdministration.options}
        onSelect={currentAdministration.select}
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
            {propertiesQuery.isSuccess && propertiesQuery.data.length > 0 ? (
              <Input
                label={t('search.label')}
                placeholder={t('search.placeholder')}
                type="search"
                value={propertySearch}
                onChange={(event) => {
                  setPropertySearch(event.target.value)
                }}
              />
            ) : null}
            <PropertiesSection query={propertiesQuery} occupancy={propertyOccupancy} searchTerm={propertySearch} />
          </section>

          <section className={styles['section']}>
            <h2 className="text-h3">{t('parking:section.title')}</h2>
            {parkingsQuery.isSuccess && parkingsQuery.data.length > 0 ? (
              <Input
                label={t('parking:section.search.label')}
                placeholder={t('parking:section.search.placeholder')}
                type="search"
                value={parkingSearch}
                onChange={(event) => {
                  setParkingSearch(event.target.value)
                }}
              />
            ) : null}
            <ParkingsSection
              query={parkingsQuery}
              propertiesQuery={propertiesQuery}
              emptyAction={addPropertyCta}
              searchTerm={parkingSearch}
            />
          </section>
        </>
      )}
    </div>
  )
}
