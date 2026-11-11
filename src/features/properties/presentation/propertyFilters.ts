import { derivePropertyOccupancyStatus, type PropertyOccupancyMap, type PropertyOccupancyStatus } from '../application/usePropertyOccupancy'
import type { Property, PropertyType } from '../domain/property.types'

/** Ciudad/Tipo/Ocupación - the three local filters, combined with each
 * other and with the existing text search by AND (docs/DESIGN.md §15).
 * `'all'` means "no filter" for that field - never a real city/type/status
 * value, so a city literally named "all" couldn't collide with it. A
 * separate file (not inlined in PropertiesPage.tsx) so that file keeps
 * exporting only components (react-refresh/only-export-components). */
export interface PropertyFilters {
  city: string
  propertyType: PropertyType | 'all'
  occupancyStatus: PropertyOccupancyStatus | 'all'
}

export const DEFAULT_PROPERTY_FILTERS: PropertyFilters = {
  city: 'all',
  propertyType: 'all',
  occupancyStatus: 'all',
}

export function matchesPropertyFilters(
  property: Property,
  filters: PropertyFilters,
  occupancy: PropertyOccupancyMap,
): boolean {
  if (filters.city !== 'all' && property.city !== filters.city) return false
  if (filters.propertyType !== 'all' && property.propertyType !== filters.propertyType) return false
  if (filters.occupancyStatus !== 'all') {
    const { status } = derivePropertyOccupancyStatus(property, occupancy)
    // Never silently maps a not-ready signal to "available" - `unknown` is
    // its own, real, selectable value (docs/DESIGN.md §15), not a fallback.
    if (status !== filters.occupancyStatus) return false
  }
  return true
}

/** Unique, sorted city values from the currently-loaded Properties list -
 * recomputed only when the list itself changes, not on every keystroke/
 * filter change. */
export function uniqueCities(properties: Property[]): string[] {
  return Array.from(new Set(properties.map((property) => property.city))).sort((a, b) => a.localeCompare(b, 'es'))
}
