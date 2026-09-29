import { useEffect, useRef, useState } from 'react'
import { useTranslation, type UseTranslationResponse } from 'react-i18next'
import type { Property } from '@/features/properties/domain/property.types'
import { cx } from '@/shared/lib/cx'
import { IconBadge } from '@/shared/ui/IconBadge'
import { IconButton } from '@/shared/ui/IconButton'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@/shared/ui/icons'
import propertyCardStyles from './PropertyCard.module.css'
import styles from './PropertiesOverview.module.css'
import { PropertyCard, type PropertyDisplayStatus } from './PropertyCard'
import type { PropertyOccupancyMap } from './usePropertyOccupancy'

type PropertiesOverviewT = UseTranslationResponse<['dashboard', 'properties'], undefined>['t']

export interface PropertiesOverviewProps {
  properties: readonly Property[]
  /** Per-property occupancy cross-reference - see usePropertyOccupancy's own doc comment. */
  occupancy: PropertyOccupancyMap
}

/**
 * Derives PropertyCard's status badge + one-line detail from a real
 * Property plus the occupancy cross-reference. While `occupancy` is still
 * loading/erroring, status is the honest 'unknown' state rather than a
 * guessed 'available' - a FULL_PROPERTY's detail (its type label) doesn't
 * depend on occupancy, so it renders immediately either way; a BY_ROOMS
 * property's detail (occupied/total rooms) does, so it falls back to the
 * plain rental-mode label until occupancy resolves.
 */
function derivePropertyDisplay(
  property: Property,
  occupancy: PropertyOccupancyMap,
  t: PropertiesOverviewT,
): { status: PropertyDisplayStatus; detail: string } {
  if (property.rentalMode === 'FULL_PROPERTY') {
    const detail = t(`properties:propertyType.${property.propertyType}`)
    if (occupancy.status !== 'ready') {
      return { status: 'unknown', detail }
    }
    const entry = occupancy.byPropertyId.get(property.id)
    return { status: entry?.isOccupied ? 'rented' : 'available', detail }
  }

  if (occupancy.status !== 'ready') {
    return { status: 'unknown', detail: t('properties:rentalMode.BY_ROOMS') }
  }

  const entry = occupancy.byPropertyId.get(property.id) ?? {
    isOccupied: false,
    occupiedRooms: 0,
    totalRooms: 0,
  }
  return {
    status: entry.occupiedRooms > 0 ? 'rented' : 'available',
    detail: t('properties.roomsDetail', { occupied: entry.occupiedRooms, total: entry.totalRooms }),
  }
}

const SCROLL_EDGE_THRESHOLD_PX = 1

/** Width of the row's first card (+ its gap to the next one), used as the
 * "about one card" step for the prev/next controls - measured instead of
 * hardcoded so it keeps working if card sizing ever changes. */
function getScrollStep(row: HTMLDivElement): number {
  const firstCard = row.firstElementChild
  if (!(firstCard instanceof HTMLElement)) return row.clientWidth

  const gap = parseFloat(getComputedStyle(row).columnGap)
  return firstCard.getBoundingClientRect().width + (Number.isNaN(gap) ? 0 : gap)
}

/**
 * Horizontal, controlled scroll (not a page-wide overflow) - the row itself
 * scrolls, everything around it stays put. Real "add property" flow doesn't
 * exist yet, so the trailing card is inert like the other quick actions.
 *
 * Desktop gets discrete prev/next controls, shown only when there's actually
 * more content in that direction; touch devices rely on native swipe, so the
 * controls are hidden below the sidebar's own breakpoint instead of adding a
 * second, redundant affordance.
 */
export function PropertiesOverview({ properties, occupancy }: PropertiesOverviewProps) {
  const { t } = useTranslation(['dashboard', 'properties'])
  const rowRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const row = rowRef.current
    if (!row) return

    function updateScrollState() {
      if (!row) return
      setCanScrollLeft(row.scrollLeft > SCROLL_EDGE_THRESHOLD_PX)
      setCanScrollRight(
        row.scrollLeft + row.clientWidth < row.scrollWidth - SCROLL_EDGE_THRESHOLD_PX,
      )
    }

    updateScrollState()
    row.addEventListener('scroll', updateScrollState)
    window.addEventListener('resize', updateScrollState)
    return () => {
      row.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [properties])

  function scrollByOneCard(direction: 1 | -1) {
    const row = rowRef.current
    if (!row) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    row.scrollBy({
      left: direction * getScrollStep(row),
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }

  const hasControls = canScrollLeft || canScrollRight

  return (
    <div>
      <h2 className={cx('text-h3', styles['title'])}>{t('properties.title')}</h2>
      <div
        className={cx(styles['carousel'], hasControls && styles['hasControls'])}
        data-testid="properties-carousel"
      >
        {canScrollLeft ? (
          <IconButton
            icon={<ChevronLeftIcon size={18} />}
            aria-label={t('properties.previous')}
            variant="secondary"
            size="sm"
            className={cx(styles['control'], styles['controlLeft'])}
            onClick={() => {
              scrollByOneCard(-1)
            }}
          />
        ) : null}

        <div className={styles['row']} ref={rowRef} data-testid="properties-row">
          {properties.map((property) => {
            const { status, detail } = derivePropertyDisplay(property, occupancy, t)
            return <PropertyCard key={property.id} property={property} status={status} detail={detail} />
          })}
          <button type="button" className={propertyCardStyles['addCard']}>
            <span className={propertyCardStyles['addImage']} aria-hidden="true">
              <IconBadge
                icon={<PlusIcon size={20} />}
                tone="primary"
                size={40}
                radius="full"
                className={propertyCardStyles['addIconCircle']}
              />
            </span>
            <span className={propertyCardStyles['addBody']}>
              <span className={cx('text-body-sm', propertyCardStyles['addLabel'])}>
                {t('properties.addProperty')}
              </span>
            </span>
          </button>
        </div>

        {canScrollRight ? (
          <IconButton
            icon={<ChevronRightIcon size={18} />}
            aria-label={t('properties.next')}
            variant="secondary"
            size="sm"
            className={cx(styles['control'], styles['controlRight'])}
            onClick={() => {
              scrollByOneCard(1)
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
