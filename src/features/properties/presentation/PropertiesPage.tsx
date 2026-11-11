import { useMemo, useState, type ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useActiveAdministration } from '@/features/administration/application/useActiveAdministration'
import { AdministrationPicker } from '@/features/administration/presentation/AdministrationPicker'
import { useParkings } from '@/features/parking/application/useParkings'
import type { Parking } from '@/features/parking/domain/parking.types'
import { ParkingListCard } from '@/features/parking/presentation/ParkingListCard'
import { Alert } from '@/shared/ui/Alert'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { BuildingIcon, CarIcon, HomeIcon } from '@/shared/ui/icons'
import { IconBadge } from '@/shared/ui/IconBadge'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Skeleton } from '@/shared/ui/Skeleton'
import {
  derivePropertyListDisplay,
  deriveUnitsAndOccupancy,
  PROPERTY_STATUS_LABEL_KEY,
  PROPERTY_STATUS_TONE,
} from './derivePropertyListDisplay'
import styles from './PropertiesPage.module.css'
import { PropertyListCard } from './PropertyListCard'
import {
  DEFAULT_PROPERTY_FILTERS,
  matchesPropertyFilters,
  uniqueCities,
  type PropertyFilters,
} from './propertyFilters'
import { useProperties } from '../application/useProperties'
import { derivePropertyOccupancyStatus, usePropertyOccupancy, type PropertyOccupancyMap } from '../application/usePropertyOccupancy'
import type { Property } from '../domain/property.types'

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

export interface PropertiesFiltersProps {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  filters: PropertyFilters
  onFiltersChange: (filters: PropertyFilters) => void
  /** Unique cities of the already-loaded list - see uniqueCities(). */
  cityOptions: string[]
  /** The occupancy cross-reference isn't 'ready' yet (loading or failed), so
   * every property currently derives to "Sin datos" - the Ocupación filter
   * still works (and "Sin datos" is one of its real options), but it says so
   * instead of silently looking broken. */
  occupancyPending: boolean
}

/**
 * Text search + the three local filters (Ciudad, Tipo, Ocupación) over the
 * already-loaded list - no new query, no RPC, combined by AND (see
 * matchesPropertyFilters and docs/DESIGN.md §15). Exported as its own
 * component so PropertiesVisualPreview renders these exact controls rather
 * than a look-alike copy that could drift from them.
 */
export function PropertiesFilters({
  searchTerm,
  onSearchTermChange,
  filters,
  onFiltersChange,
  cityOptions,
  occupancyPending,
}: PropertiesFiltersProps) {
  const { t } = useTranslation('properties')

  return (
    <div className={styles['filters']}>
      <Input
        label={t('search.label')}
        placeholder={t('search.placeholder')}
        type="search"
        value={searchTerm}
        onChange={(event) => {
          onSearchTermChange(event.target.value)
        }}
      />
      <Select
        label={t('filters.city.label')}
        // The empty string is the HTML <select> value for "no city filter"
        // (`filters.city === null`) - never a real option's value, since a
        // real city is always a non-empty string (see PropertyFilters's own
        // doc comment for why `null`, not an `'all'` string, is the
        // sentinel here).
        value={filters.city ?? ''}
        onChange={(event) => {
          onFiltersChange({ ...filters, city: event.target.value === '' ? null : event.target.value })
        }}
      >
        <option value="">{t('filters.city.all')}</option>
        {cityOptions.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </Select>
      <Select
        label={t('filters.type.label')}
        value={filters.propertyType}
        onChange={(event) => {
          onFiltersChange({ ...filters, propertyType: event.target.value as PropertyFilters['propertyType'] })
        }}
      >
        <option value="all">{t('filters.type.all')}</option>
        <option value="HOUSE">{t('propertyType.HOUSE')}</option>
        <option value="APARTMENT">{t('propertyType.APARTMENT')}</option>
      </Select>
      <Select
        label={t('filters.occupancy.label')}
        hint={occupancyPending ? t('filters.occupancy.loadingHint') : undefined}
        value={filters.occupancyStatus}
        onChange={(event) => {
          onFiltersChange({
            ...filters,
            occupancyStatus: event.target.value as PropertyFilters['occupancyStatus'],
          })
        }}
      >
        <option value="all">{t('filters.occupancy.all')}</option>
        <option value="rented">{t('occupancy.rented')}</option>
        <option value="available">{t('occupancy.available')}</option>
        <option value="unknown">{t('occupancy.statusUnknown')}</option>
      </Select>
    </div>
  )
}

export interface PropertiesSectionProps {
  /** Narrowed to just the fields this section reads (not the full
   * UseQueryResult) so PropertiesVisualPreview can pass plain mock objects
   * instead of a real query result - same pattern DashboardContent's own
   * props use for its query-shaped props. */
  query: Pick<UseQueryResult<Property[]>, 'data' | 'isLoading' | 'isError'>
  occupancy: PropertyOccupancyMap
  searchTerm: string
  filters: PropertyFilters
}

/**
 * A visually-hidden announcement of the active search's own result count
 * (or lack of it) - a localized live region per section, not a change to
 * the shared/ui EmptyState primitive, which stays purely visual. Permanently
 * mounted (the `<p>` itself, not just a wrapper) with empty text until a
 * search is active - some assistive tech only reliably announces an
 * aria-live region's *updates*, not a region that appears already carrying
 * its first value, so this never conditionally mounts/unmounts the node
 * itself across the first term, later terms, and clearing. Screen readers
 * announce it without any focus movement, since nothing here ever calls
 * .focus().
 */
function SearchResultsStatus({
  isActive,
  resultCount,
  resultsAnnouncement,
  noResultsAnnouncement,
  testId,
}: {
  /** Whether *any* narrowing is currently applied - text search for
   * Parqueaderos, but text search OR a local filter for Propiedades (third
   * audit, PR #26: filters applied with an empty search box left this
   * region silent even though the visible count had changed). */
  isActive: boolean
  resultCount: number
  resultsAnnouncement: string
  noResultsAnnouncement: string
  testId: string
}) {
  return (
    <p role="status" aria-live="polite" className="sr-only" data-testid={testId}>
      {isActive ? (resultCount > 0 ? resultsAnnouncement : noResultsAnnouncement) : ''}
    </p>
  )
}

export function PropertiesSection({ query, occupancy, searchTerm, filters }: PropertiesSectionProps) {
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

  const visible = properties.filter(
    (property) =>
      matchesSearch(searchTerm, property.name, property.address, property.city) &&
      matchesPropertyFilters(property, filters, occupancy),
  )
  const hasActiveFilters =
    filters.city !== null || filters.propertyType !== 'all' || filters.occupancyStatus !== 'all'
  // A filter alone (no text typed) still narrows the list - the live
  // region must speak up for that case too, not just for text search.
  const isFiltering = searchTerm.trim().length > 0 || hasActiveFilters

  return (
    <>
      <SearchResultsStatus
        isActive={isFiltering}
        resultCount={visible.length}
        resultsAnnouncement={t('search.resultsAnnouncement', { count: visible.length })}
        noResultsAnnouncement={
          searchTerm.trim()
            ? t('search.noResults.description', { query: searchTerm })
            : t('search.noMatches.description')
        }
        testId="properties-search-status"
      />
      {visible.length === 0 ? (
        <EmptyState
          icon={<BuildingIcon size={24} />}
          title={searchTerm.trim() ? t('search.noResults.title', { query: searchTerm }) : t('search.noMatches.title')}
          description={
            searchTerm.trim() ? t('search.noResults.description', { query: searchTerm }) : t('search.noMatches.description')
          }
        />
      ) : (
        <>
          {/* Desktop (>=1024px): a real data table, the approved Figma
              candidate's "tabla de inmuebles en escritorio" with its five
              columns (docs/DESIGN.md §15: Inmueble | Dirección | Tipo |
              Unidades | Ocupación). Both this and the compact list below
              always render; CSS (not JS) picks one per breakpoint, the same
              technique AppShell already uses for its sidebar vs. drawer+
              bottom-nav. */}
          <div
            className={styles['tableWrap']}
            role="region"
            aria-label={t('sections.properties')}
            tabIndex={0}
            data-testid="properties-table"
          >
            <table className={styles['table']}>
              <caption className="sr-only">{t('sections.properties')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('table.property')}</th>
                  <th scope="col">{t('table.address')}</th>
                  <th scope="col">{t('table.type')}</th>
                  <th scope="col">{t('table.units')}</th>
                  <th scope="col">{t('table.occupancy')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((property) => {
                  const { status } = derivePropertyOccupancyStatus(property, occupancy)
                  const { units, occupiedUnits } = deriveUnitsAndOccupancy(property, occupancy)
                  const PropertyIcon = property.propertyType === 'HOUSE' ? HomeIcon : BuildingIcon

                  return (
                    <tr key={property.id}>
                      <td>
                        <div className={styles['propertyCell']}>
                          <IconBadge icon={<PropertyIcon size={16} />} tone="neutral" size={32} radius="md" />
                          <div>
                            <p className={styles['name']}>{property.name}</p>
                            <p className="text-caption text-muted">{t(`rentalMode.${property.rentalMode}`)}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="text-caption">{property.address}</p>
                        <p className="text-caption text-muted">{property.city}</p>
                      </td>
                      <td>
                        <Badge tone="neutral">{t(`propertyType.${property.propertyType}`)}</Badge>
                      </td>
                      <td className="tabular-nums">
                        {units === null ? (
                          <span aria-label={t('occupancy.statusUnknown')}>—</span>
                        ) : (
                          units
                        )}
                      </td>
                      <td>
                        <div className={styles['occupancyCell']}>
                          {units !== null && occupiedUnits !== null ? (
                            <span className="tabular-nums">
                              {occupiedUnits}/{units}
                            </span>
                          ) : null}
                          <Badge tone={PROPERTY_STATUS_TONE[status]}>{t(PROPERTY_STATUS_LABEL_KEY[status])}</Badge>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Below 1024px: the compact card - "tarjetas compactas en
              móvil". See the table above for why both always render. */}
          <div className={styles['compactList']} data-testid="properties-compact-list">
            {visible.map((property) => {
              const { status, unitsOccupancyLabel } = derivePropertyListDisplay(property, occupancy, t)
              return (
                <PropertyListCard
                  key={property.id}
                  property={property}
                  status={status}
                  unitsOccupancyLabel={unitsOccupancyLabel}
                />
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

export interface ParkingsSectionProps {
  query: Pick<UseQueryResult<Parking[]>, 'data' | 'isLoading' | 'isError'>
  propertiesQuery: Pick<UseQueryResult<Property[]>, 'data' | 'isSuccess'>
  emptyAction: ReactNode
  searchTerm: string
}

export function ParkingsSection({ query, propertiesQuery, emptyAction, searchTerm }: ParkingsSectionProps) {
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

  return (
    <>
      <SearchResultsStatus
        isActive={searchTerm.trim().length > 0}
        resultCount={visible.length}
        resultsAnnouncement={t('section.search.resultsAnnouncement', { count: visible.length })}
        noResultsAnnouncement={t('section.search.noResults.description', { query: searchTerm })}
        testId="parkings-search-status"
      />
      {visible.length === 0 ? (
        <EmptyState
          icon={<CarIcon size={24} />}
          title={t('section.search.noResults.title', { query: searchTerm })}
          description={t('section.search.noResults.description', { query: searchTerm })}
        />
      ) : (
        // One shared bordered container, each parking a compact divided row
        // inside it - the approved Figma candidate's "filas compactas para
        // parqueaderos", a single pattern at every width (unlike Properties,
        // which switches between a table and a card by breakpoint).
        <div className={styles['parkingList']} data-testid="parking-list">
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
      )}
    </>
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
  const [propertyFilters, setPropertyFilters] = useState<PropertyFilters>(DEFAULT_PROPERTY_FILTERS)

  // A filter/search term that matched the previous administration's data
  // could silently hide everything in the new one (e.g. a city that only
  // existed there) - starting clean on every administration switch avoids
  // that trap. Adjusted during render (React's recommended pattern for
  // "reset state when a prop changes") instead of a useEffect, since a
  // direct setState in an effect body trips react-hooks/set-state-in-effect.
  const [prevAdministrationId, setPrevAdministrationId] = useState(administrationId)
  if (administrationId !== prevAdministrationId) {
    setPrevAdministrationId(administrationId)
    setPropertySearch('')
    setParkingSearch('')
    setPropertyFilters(DEFAULT_PROPERTY_FILTERS)
  }

  // Recomputed only when the Properties list itself changes - not on every
  // filter/search keystroke.
  const cityOptions = useMemo(
    () => (propertiesQuery.isSuccess ? uniqueCities(propertiesQuery.data) : []),
    [propertiesQuery.isSuccess, propertiesQuery.data],
  )

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
              <PropertiesFilters
                searchTerm={propertySearch}
                onSearchTermChange={setPropertySearch}
                filters={propertyFilters}
                onFiltersChange={setPropertyFilters}
                cityOptions={cityOptions}
                occupancyPending={propertyOccupancy.status !== 'ready'}
              />
            ) : null}
            <PropertiesSection
              query={propertiesQuery}
              occupancy={propertyOccupancy}
              searchTerm={propertySearch}
              filters={propertyFilters}
            />
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
