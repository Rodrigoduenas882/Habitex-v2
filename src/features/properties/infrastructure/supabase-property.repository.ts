import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  PropertyRepositoryError,
  type Property,
  type PropertyRepository,
  type PropertyType,
  type RentalMode,
} from '../domain/property.types'

interface PropertyRow {
  id: string
  administration_id: string
  property_type: PropertyType
  rental_mode: RentalMode
  name: string
  country_code: string
  city: string
  address: string
  has_administration: boolean
  administration_fee: number | null
}

const PROPERTY_COLUMNS =
  'id, administration_id, property_type, rental_mode, name, country_code, city, address, has_administration, administration_fee'

function toProperty(row: PropertyRow): Property {
  return {
    id: row.id,
    administrationId: row.administration_id,
    propertyType: row.property_type,
    rentalMode: row.rental_mode,
    name: row.name,
    countryCode: row.country_code,
    city: row.city,
    address: row.address,
    hasAdministration: row.has_administration,
    administrationFee: row.administration_fee,
  }
}

export const supabasePropertyRepository: PropertyRepository = {
  async listByAdministration(administrationId: string) {
    // administration_id expresses this query's scope and avoids fetching
    // other administrations' rows unnecessarily - RLS (membership of
    // administration_id) remains the actual security authority regardless.
    // No RentalRelationship/occupancy, no Storage - only what properties
    // itself owns.
    const { data, error } = await supabaseClient
      .from('properties')
      .select(PROPERTY_COLUMNS)
      .eq('administration_id', administrationId)

    if (error) {
      throw new PropertyRepositoryError('Failed to list properties for the administration', error)
    }

    return (data as PropertyRow[]).map(toProperty)
  },
}
