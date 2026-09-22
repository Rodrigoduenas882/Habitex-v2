/** property_type, confirmed against the deployed schema. */
export type PropertyType = 'HOUSE' | 'APARTMENT'

/** rental_mode, confirmed against the deployed schema. */
export type RentalMode = 'FULL_PROPERTY' | 'BY_ROOMS'

/**
 * A property (inmueble), scoped to a single administration. Deliberately
 * does not carry any occupancy/rented-available field - that information
 * does not exist on the properties table. Occupancy belongs to
 * RentalRelationship and will be resolved separately, later, once that
 * agregate exists.
 */
export interface Property {
  id: string
  administrationId: string
  propertyType: PropertyType
  rentalMode: RentalMode
  name: string
  countryCode: string
  city: string
  address: string
  hasAdministration: boolean
  administrationFee: number | null
}

/**
 * Wraps a failed Supabase call so nothing above infrastructure/ ever sees a
 * raw PostgrestError.
 */
export class PropertyRepositoryError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'PropertyRepositoryError'
    this.cause = cause
  }
}

/**
 * Shared payload for both create_full_property_asset and
 * create_room_rental_property - the two RPCs take the same base columns.
 * Deliberately has no rentalMode field: which RPC you call already
 * expresses that intent (createFullProperty vs createRoomRentalProperty),
 * so the input doesn't need to repeat it.
 */
export interface CreatePropertyInput {
  administrationId: string
  propertyType: PropertyType
  name: string
  city: string
  address: string
  countryCode: string
  hasAdministration: boolean
  administrationFee: number | null
}

/**
 * Lists the properties of a single administration. The caller passes
 * administrationId explicitly to express query scope (and keep query keys
 * correctly namespaced) - RLS (membership of administration_id) remains the
 * actual security authority regardless of what this filter expresses.
 *
 * createFullProperty and createRoomRentalProperty are deliberately two
 * separate methods, not one createProperty(input, mode) - they call two
 * different RPCs with two different real-world meanings (a single
 * arrendable asset vs. the base property for a future set of rooms), and a
 * generic method would hide that difference instead of expressing it.
 *
 * create_full_property_asset returns `rental_subjects`, not `properties` -
 * its result is intentionally not surfaced here (see
 * PropertyRepository.createFullProperty's own doc comment). No getById yet.
 */
export interface PropertyRepository {
  listByAdministration(administrationId: string): Promise<Property[]>

  /**
   * Calls create_full_property_asset (rental_mode FULL_PROPERTY, implied by
   * calling this method rather than createRoomRentalProperty). Returns void
   * on purpose: the RPC returns a rental_subjects row, not a Property, and
   * nothing in this increment's flow (success -> invalidate -> feedback ->
   * navigate to /properties) needs to read anything back from it. Casting
   * that row to Property would be dishonest about what the RPC actually
   * returns.
   */
  createFullProperty(input: CreatePropertyInput): Promise<void>

  /**
   * Calls create_room_rental_property (rental_mode BY_ROOMS, implied by
   * calling this method). Returns the created Property - unlike
   * createFullProperty, this RPC genuinely returns a `properties` row, and
   * the application needs its id to navigate to the room setup screen.
   */
  createRoomRentalProperty(input: CreatePropertyInput): Promise<Property>
}
