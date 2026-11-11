import { derivePropertyOccupancyStatus, type PropertyOccupancyMap, type PropertyOccupancyStatus } from '../application/usePropertyOccupancy'
import type { Property, PropertyType } from '../domain/property.types'

/** Ciudad/Tipo/Ocupación - the three local filters, combined with each
 * other and with the existing text search by AND (docs/DESIGN.md §15). A
 * separate file (not inlined in PropertiesPage.tsx) so that file keeps
 * exporting only components (react-refresh/only-export-components).
 *
 * `propertyType`/`occupancyStatus` use `'all'` as their "no filter" sentinel
 * safely, because both are closed unions a real value can never escape
 * ('HOUSE'/'APARTMENT', 'rented'/'available'/'unknown') - `'all'` is
 * statically impossible as a real value. `city` is different: it is
 * free-text user input (`z.string().min(1)`, see property-base-form.ts),
 * so a property whose real city happens to be the literal string "all"
 * would make a `'all'`-sentinel collide with it, silently matching every
 * property as if no city filter were active. The third audit of PR #26
 * found exactly this by substituting a fixture's city with "all". `city`
 * therefore uses `null`, not a string sentinel - a real city can never be
 * `null`, and the schema's `min(1)` also rules out `''`. */
export interface PropertyFilters {
  city: string | null
  propertyType: PropertyType | 'all'
  occupancyStatus: PropertyOccupancyStatus | 'all'
}

export const DEFAULT_PROPERTY_FILTERS: PropertyFilters = {
  city: null,
  propertyType: 'all',
  occupancyStatus: 'all',
}

export function matchesPropertyFilters(
  property: Property,
  filters: PropertyFilters,
  occupancy: PropertyOccupancyMap,
): boolean {
  if (filters.city !== null && property.city !== filters.city) return false
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
