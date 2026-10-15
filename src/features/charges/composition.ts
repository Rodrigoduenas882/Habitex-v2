import type { ChargeRepository } from './domain/charge.types'
import { supabaseChargeRepository } from './infrastructure/supabase-charge.repository'

/**
 * The one place that decides which repository implementation this feature's
 * port gets. application/ depends on this binding, never on the concrete
 * adapter's import path - same pattern as features/contracts/composition.ts.
 */
export const chargeRepository: ChargeRepository = supabaseChargeRepository
