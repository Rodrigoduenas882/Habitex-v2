import type { RentalRepository } from './domain/rental.types'
import { supabaseRentalRepository } from './infrastructure/supabase-rental.repository'

/**
 * The one place that decides which RentalRepository implementation the
 * rest of the feature gets. application/ depends on this binding, never on
 * the concrete adapter's import path directly - same pattern as
 * features/properties/composition.ts and features/parking/composition.ts.
 */
export const rentalRepository: RentalRepository = supabaseRentalRepository
