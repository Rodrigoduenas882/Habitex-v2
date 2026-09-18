import { supabaseClient } from '@/infrastructure/supabase/client'
import { ParkingRepositoryError, type CreateParkingInput, type ParkingRepository } from '../domain/parking.types'

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
}
