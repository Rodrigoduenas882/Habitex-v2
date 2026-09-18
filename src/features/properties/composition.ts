import type { PropertyRepository } from './domain/property.types'
import { supabasePropertyRepository } from './infrastructure/supabase-property.repository'

/**
 * The one place that decides which PropertyRepository implementation the
 * rest of the feature gets. application/ depends on this binding, never on
 * the concrete adapter's import path directly - same pattern as
 * features/auth/composition.ts and features/administration/composition.ts.
 */
export const propertyRepository: PropertyRepository = supabasePropertyRepository
