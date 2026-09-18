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
 * A parking (parqueadero) as listed for an administration. Deliberately
 * does not carry accessType/observations/createdAt/updatedAt - nothing in
 * the current UI (the /properties list) needs them; adding them now would
 * anticipate a detail screen that doesn't exist yet.
 */
export interface Parking {
  id: string
  administrationId: string
  propertyId: string | null
  identifier: string
  location: string | null
  covered: boolean | null
  allowedVehicleType: VehicleType | null
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
 * create() returns void on purpose: nothing in this flow needs to read
 * anything back from it - listByAdministration (a real query against
 * parkings, not rental_subjects) is how the UI now learns a parking exists.
 *
 * No update/delete yet - this increment only needs to list and create.
 */
export interface ParkingRepository {
  create(input: CreateParkingInput): Promise<void>
  listByAdministration(administrationId: string): Promise<Parking[]>
}
