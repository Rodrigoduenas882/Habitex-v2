import type { UseTranslationResponse } from 'react-i18next'
import type { BadgeTone } from '@/shared/ui/Badge'
import {
  derivePropertyOccupancyStatus,
  type PropertyOccupancyMap,
  type PropertyOccupancyStatus,
} from '../application/usePropertyOccupancy'
import type { Property } from '../domain/property.types'

type PropertiesSectionT = UseTranslationResponse<'properties', undefined>['t']

/** Shared occupancy-status -> Badge tone/label mapping - the single
 * definition every surface that shows this badge (PropertyListCard, the
 * desktop table's Ocupación column) reads from, never its own copy. */
export const PROPERTY_STATUS_TONE: Record<PropertyOccupancyStatus, BadgeTone> = {
  rented: 'success',
  available: 'info',
  unknown: 'neutral',
}

export const PROPERTY_STATUS_LABEL_KEY: Record<
  PropertyOccupancyStatus,
  'occupancy.rented' | 'occupancy.available' | 'occupancy.statusUnknown'
> = {
  rented: 'occupancy.rented',
  available: 'occupancy.available',
  unknown: 'occupancy.statusUnknown',
}

export interface UnitsAndOccupancy {
  /** "Unidades" per the approved Figma correspondence (docs/DESIGN.md §15):
   * 1 for FULL_PROPERTY, the enabled room count for BY_ROOMS. `null` only
   * when the occupancy cross-reference isn't ready (loading/errored) -
   * never guessed, never defaulted to 0. */
  units: number | null
  /** "Ocupación"'s numerator - `null` under the same not-ready condition as
   * `units` (always both-or-neither). */
  occupiedUnits: number | null
}

/**
 * The single source for the desktop table's Unidades/Ocupación columns AND
 * the compact card's combined caption below - both read from here instead
 * of re-deriving FULL_PROPERTY-vs-BY_ROOMS branching twice. Built from the
 * shared, pure derivePropertyOccupancyStatus (see usePropertyOccupancy's
 * own doc comment) - never a second computation of "is this occupied".
 */
export function deriveUnitsAndOccupancy(property: Property, occupancy: PropertyOccupancyMap): UnitsAndOccupancy {
  if (occupancy.status !== 'ready') {
    return { units: null, occupiedUnits: null }
  }

  const entry = occupancy.byPropertyId.get(property.id)

  if (property.rentalMode === 'FULL_PROPERTY') {
    return { units: 1, occupiedUnits: entry?.isOccupied ? 1 : 0 }
  }

  return { units: entry?.totalRooms ?? 0, occupiedUnits: entry?.occupiedRooms ?? 0 }
}

/**
 * The compact card's own i18n-formatted "X de Y unidades ocupadas" caption
 * (properties.json's `table.unitsOccupancy`, not dashboard.json's) - `null`
 * while deriveUnitsAndOccupancy isn't ready yet, so the card simply omits
 * the line instead of showing a guess. A separate file (not inlined in
 * PropertiesPage.tsx) so PropertiesVisualPreview can reuse the exact same
 * formatting instead of drifting with its own copy, and so that file keeps
 * exporting only components (react-refresh/only-export-components).
 */
export function derivePropertyListDisplay(
  property: Property,
  occupancy: PropertyOccupancyMap,
  t: PropertiesSectionT,
): { status: PropertyOccupancyStatus; unitsOccupancyLabel: string | null } {
  const { status } = derivePropertyOccupancyStatus(property, occupancy)
  const { units, occupiedUnits } = deriveUnitsAndOccupancy(property, occupancy)

  if (units === null || occupiedUnits === null) {
    return { status, unitsOccupancyLabel: null }
  }

  return { status, unitsOccupancyLabel: t('table.unitsOccupancy', { occupied: occupiedUnits, total: units }) }
}
