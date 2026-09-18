import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  RoomRepositoryError,
  type BathroomType,
  type CreateRoomInput,
  type Room,
  type RoomRepository,
  type RoomRepositoryErrorCode,
} from '../domain/room.types'

interface RoomRow {
  id: string
  property_id: string
  name: string
  bathroom_type: BathroomType | null
  furnished: boolean
  description: string | null
  is_enabled: boolean
}

const ROOM_COLUMNS = 'id, property_id, name, bathroom_type, furnished, description, is_enabled'

/** Postgres' standard unique_violation SQLSTATE - not RPC-specific. */
const POSTGRES_UNIQUE_VIOLATION = '23505'

function toRoom(row: RoomRow): Room {
  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    bathroomType: row.bathroom_type,
    furnished: row.furnished,
    description: row.description,
    isEnabled: row.is_enabled,
  }
}

function toRoomRepositoryErrorCode(error: unknown): RoomRepositoryErrorCode {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === POSTGRES_UNIQUE_VIOLATION
  ) {
    return 'duplicate_name'
  }
  return 'unknown'
}

export const supabaseRoomRepository: RoomRepository = {
  async listByProperty(propertyId: string) {
    // property_id expresses this query's scope - RLS
    // (is_administration_member(administration_id)) remains the actual
    // security authority regardless of this filter.
    const { data, error } = await supabaseClient
      .from('rooms')
      .select(ROOM_COLUMNS)
      .eq('property_id', propertyId)

    if (error) {
      throw new RoomRepositoryError('Failed to list rooms for the property', 'unknown', error)
    }

    return (data as RoomRow[]).map(toRoom)
  },

  async createForProperty(input: CreateRoomInput) {
    // create_room_asset re-validates property existence, BY_ROOMS mode and
    // management access server-side - no direct insert, no service role,
    // no bypass. Returns a rental_subjects row, deliberately not read - see
    // RoomRepository's own doc comment.
    const { error } = await supabaseClient.rpc('create_room_asset', {
      p_property_id: input.propertyId,
      p_name: input.name,
      p_bathroom_type: input.bathroomType,
      p_furnished: input.furnished,
      p_description: input.description,
    })

    if (error) {
      throw new RoomRepositoryError('Failed to create the room', toRoomRepositoryErrorCode(error), error)
    }
  },
}
