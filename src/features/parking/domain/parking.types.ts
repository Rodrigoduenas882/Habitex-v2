/** vehicle_type, confirmed against the deployed schema. */
export type VehicleType = 'CAR' | 'MOTORCYCLE' | 'BOTH'

/**
 * A parking (parqueadero) - a rental subject independent from Property.
 * propertyId is optional by design: a parking can exist on its own, or be
 * associated to a property the current administration already manages.
 */
export interface CreateParkingInput {
  administrationId: string
  propertyId: string | null
  identifier: string
  location: string | null
  covered: boolean | null
  allowedVehicleType: VehicleType | null
  accessType: string | null
  observations: string | null
}

/**
 * Wraps a failed Supabase call so nothing above infrastructure/ ever sees a
 * raw PostgrestError.
 */
export class ParkingRepositoryError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'ParkingRepositoryError'
    this.cause = cause
  }
}

/**
 * create_parking_asset returns a rental_subjects row, not a parkings row,
 * and its shape is not confirmed against this repo (same situation as
 * PropertyRepository.createFullProperty and RoomRepository.createForProperty).
 * create() returns void on purpose: nothing in this increment's flow
 * (success -> explicit confirmation -> manual "Volver a inmuebles") needs to
 * read anything back from it.
 *
 * No read model yet (no Parking type, no listByAdministration) - this
 * increment only needs to create. No update/delete either.
 */
export interface ParkingRepository {
  create(input: CreateParkingInput): Promise<void>
}
