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
 * definition every surface that shows this badge (PropertyListCard,
 * PropertiesPage's desktop table) reads from, never its own copy. */
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

/**
 * This section's own i18n-formatted detail string, built from the shared,
 * pure derivePropertyOccupancyStatus (see usePropertyOccupancy's own doc
 * comment) - the status computation itself is never re-derived here, only
 * formatted into this feature's own copy (properties.json's `occupancy`
 * keys, not dashboard.json's). A separate file (not inlined in
 * PropertiesPage.tsx) so PropertiesVisualPreview can reuse the exact same
 * formatting instead of drifting with its own copy, and so that file keeps
 * exporting only a component (react-refresh/only-export-components).
 */
export function derivePropertyListDisplay(
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
