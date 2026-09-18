import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  PropertyRepositoryError,
  type CreatePropertyInput,
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

/** create_full_property_asset / create_room_rental_property share this exact param shape. */
function toRpcArgs(input: CreatePropertyInput) {
  return {
    p_administration_id: input.administrationId,
    p_property_type: input.propertyType,
    p_name: input.name,
    p_city: input.city,
    p_address: input.address,
    p_country_code: input.countryCode,
    p_has_administration: input.hasAdministration,
    p_administration_fee: input.administrationFee,
  }
}

/** RPCs that return a single composite row can come back as an object or a
 * one-element array depending on how PostgREST serializes the function's
 * return type - handled defensively rather than assumed. */
function firstRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null
  return data
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

  async createFullProperty(input: CreatePropertyInput) {
    // Management access, name/city/address validation and RLS all happen
    // inside the RPC (can_manage_administration()) - no service role, no
    // direct insert, no bypass. The RPC returns a rental_subjects row,
    // which is deliberately not read - see this method's doc comment on
    // PropertyRepository.
    const { error } = await supabaseClient.rpc('create_full_property_asset', toRpcArgs(input))

    if (error) {
      throw new PropertyRepositoryError('Failed to create the property', error)
    }
  },

  async createRoomRentalProperty(input: CreatePropertyInput) {
    const response = await supabaseClient.rpc('create_room_rental_property', toRpcArgs(input))

    if (response.error) {
      throw new PropertyRepositoryError('Failed to create the property', response.error)
    }

    const row = firstRow(response.data as PropertyRow | PropertyRow[] | null)
    if (!row) {
      throw new PropertyRepositoryError('create_room_rental_property returned no property row')
    }

    return toProperty(row)
  },
}
