import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { IconButton } from '@/shared/ui/IconButton'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@/shared/ui/icons'
import propertyCardStyles from './PropertyCard.module.css'
import styles from './PropertiesOverview.module.css'
import { PropertyCard } from './PropertyCard'
import type { PropertySummary } from './dashboard-mock-data'

export interface PropertiesOverviewProps {
  properties: readonly PropertySummary[]
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
export function PropertiesOverview({ properties }: PropertiesOverviewProps) {
  const { t } = useTranslation('dashboard')
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
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
          <button type="button" className={propertyCardStyles['addCard']}>
            <span className={propertyCardStyles['addImage']} aria-hidden="true">
              <span className={propertyCardStyles['addIconCircle']}>
                <PlusIcon size={20} />
              </span>
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
