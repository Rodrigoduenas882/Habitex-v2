import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  ParkingRepositoryError,
  type CreateParkingInput,
  type Parking,
  type ParkingRepository,
  type VehicleType,
} from '../domain/parking.types'

interface ParkingRow {
  id: string
  administration_id: string
  property_id: string | null
  identifier: string
  location: string | null
  covered: boolean | null
  allowed_vehicle_type: VehicleType | null
}

const PARKING_COLUMNS = 'id, administration_id, property_id, identifier, location, covered, allowed_vehicle_type'

function toParking(row: ParkingRow): Parking {
  return {
    id: row.id,
    administrationId: row.administration_id,
    propertyId: row.property_id,
    identifier: row.identifier,
    location: row.location,
    covered: row.covered,
    allowedVehicleType: row.allowed_vehicle_type,
  }
}

export const supabaseParkingRepository: ParkingRepository = {
  async create(input: CreateParkingInput) {
    // Management access, identifier validation and property/administration
    // ownership validation all happen inside the RPC - no direct insert, no
    // service role, no bypass. Returns a rental_subjects row, deliberately
    // not read - see ParkingRepository's own doc comment.
    const { error } = await supabaseClient.rpc('create_parking_asset', {
      p_administration_id: input.administrationId,
      p_identifier: input.identifier,
      p_property_id: input.propertyId,
      p_location: input.location,
      p_covered: input.covered,
      p_allowed_vehicle_type: input.allowedVehicleType,
      p_access_type: input.accessType,
      p_observations: input.observations,
    })

    if (error) {
      throw new ParkingRepositoryError('Failed to create the parking', error)
    }
  },

  async listByAdministration(administrationId: string) {
    // administration_id expresses this query's scope - RLS remains the
    // actual security authority regardless of this filter. No joins, no
    // rental_subjects read.
    const { data, error } = await supabaseClient
      .from('parkings')
      .select(PARKING_COLUMNS)
      .eq('administration_id', administrationId)

    if (error) {
      throw new ParkingRepositoryError('Failed to list parkings for the administration', error)
    }

    return (data as ParkingRow[]).map(toParking)
  },
}
