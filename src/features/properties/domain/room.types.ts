/** bathroom_type, confirmed against the deployed schema. */
export type BathroomType = 'PRIVATE' | 'SHARED'

/**
 * A room belongs to a BY_ROOMS property. Lives inside the properties
 * feature (not a separate feature) because nothing yet justifies pulling it
 * out.
 */
export interface Room {
  id: string
  propertyId: string
  name: string
  bathroomType: BathroomType | null
  furnished: boolean
  description: string | null
  isEnabled: boolean
}

export interface CreateRoomInput {
  propertyId: string
  name: string
  bathroomType: BathroomType | null
  furnished: boolean
  description: string | null
}

/**
 * 'duplicate_name' maps Postgres' unique_violation (SQLSTATE 23505) against
 * the confirmed UNIQUE(property_id, name) constraint - a stable, standard
 * Postgres error code, not something invented for this RPC specifically.
 * Everything else falls back to 'unknown', same pattern as
 * SessionAuthError.
 */
export type RoomRepositoryErrorCode = 'duplicate_name' | 'unknown'

/**
 * Wraps a failed Supabase call so nothing above infrastructure/ ever sees a
 * raw PostgrestError.
 */
export class RoomRepositoryError extends Error {
  readonly code: RoomRepositoryErrorCode

  constructor(message: string, code: RoomRepositoryErrorCode = 'unknown', cause?: unknown) {
    super(message)
    this.name = 'RoomRepositoryError'
    this.code = code
    this.cause = cause
  }
}

/**
 * listByProperty is the backend authority for "how many rooms does this
 * property have" - RoomSetupPage relies on it (not navigation state or
 * local component state) to decide whether "Terminar configuración" can be
 * enabled, including after a refresh. RLS (membership of administration_id)
 * remains the actual security authority regardless of the property_id
 * filter expressed here.
 *
 * createForProperty still returns void: create_room_asset returns a
 * rental_subjects row, not a rooms row, and its shape is not confirmed
 * against this repo - callers that need the created room back rely on
 * listByProperty (now that it exists) rather than a cast of that return
 * value.
 *
 * No update/delete yet - this increment only needs to list and create.
 */
export interface RoomRepository {
  listByProperty(propertyId: string): Promise<Room[]>
  createForProperty(input: CreateRoomInput): Promise<void>
}
