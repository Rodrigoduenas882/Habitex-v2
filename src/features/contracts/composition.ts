import type { ContractRepository } from './domain/contract.types'
import { supabaseContractRepository } from './infrastructure/supabase-contract.repository'

/**
 * The one place that decides which repository implementation this feature's
 * port gets. application/ depends on this binding, never on the concrete
 * adapter's import path - same pattern as features/rentals/composition.ts.
 */
export const contractRepository: ContractRepository = supabaseContractRepository
