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
 * Lists the properties of a single administration. The caller passes
 * administrationId explicitly to express query scope (and keep query keys
 * correctly namespaced) - RLS (membership of administration_id) remains the
 * actual security authority regardless of what this filter expresses.
 *
 * No create/update/delete/getById yet - this increment only needs a list.
 */
export interface PropertyRepository {
  listByAdministration(administrationId: string): Promise<Property[]>
}
