import type { ParkingRepository } from './domain/parking.types'
import { supabaseParkingRepository } from './infrastructure/supabase-parking.repository'

/**
 * The one place that decides which ParkingRepository implementation the
 * rest of the feature gets. application/ depends on this binding, never on
 * the concrete adapter's import path directly - same pattern as
 * features/properties/composition.ts and features/administration/composition.ts.
 */
export const parkingRepository: ParkingRepository = supabaseParkingRepository
