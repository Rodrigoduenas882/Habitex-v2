import type { PropertyRepository } from './domain/property.types'
import type { RoomRepository } from './domain/room.types'
import { supabasePropertyRepository } from './infrastructure/supabase-property.repository'
import { supabaseRoomRepository } from './infrastructure/supabase-room.repository'

/**
 * The one place that decides which repository implementations the rest of
 * the feature gets. application/ depends on these bindings, never on a
 * concrete adapter's import path directly - same pattern as
 * features/auth/composition.ts and features/administration/composition.ts.
 */
export const propertyRepository: PropertyRepository = supabasePropertyRepository
export const roomRepository: RoomRepository = supabaseRoomRepository
