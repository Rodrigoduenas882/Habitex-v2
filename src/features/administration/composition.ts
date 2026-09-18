import type { AccountRepository, AdministrationRepository } from './domain/administration.types'
import { supabaseAccountRepository } from './infrastructure/supabase-account.repository'
import { supabaseAdministrationRepository } from './infrastructure/supabase-administration.repository'

/**
 * The one place that decides which repository implementations this feature
 * gets. application/ depends on these bindings, never on a concrete adapter's
 * import path directly - same pattern as features/auth/composition.ts.
 */
export const accountRepository: AccountRepository = supabaseAccountRepository
export const administrationRepository: AdministrationRepository = supabaseAdministrationRepository
