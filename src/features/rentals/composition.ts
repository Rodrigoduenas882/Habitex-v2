import type { RentalTermsRepository } from './domain/rental-terms.types'
import type { RentalRepository } from './domain/rental.types'
import type { RentalSubjectRepository } from './domain/rental-subject.types'
import type { TenantCandidateRepository } from './domain/tenant-candidate.types'
import { supabaseRentalTermsRepository } from './infrastructure/supabase-rental-terms.repository'
import { supabaseRentalRepository } from './infrastructure/supabase-rental.repository'
import { supabaseRentalSubjectRepository } from './infrastructure/supabase-rental-subject.repository'
import { supabaseTenantCandidateRepository } from './infrastructure/supabase-tenant-candidate.repository'

/**
 * The one place that decides which repository implementation each port of
 * this feature gets. application/ depends on these bindings, never on a
 * concrete adapter's import path directly - same pattern as
 * features/properties/composition.ts and features/parking/composition.ts.
 */
export const rentalRepository: RentalRepository = supabaseRentalRepository
export const rentalSubjectRepository: RentalSubjectRepository = supabaseRentalSubjectRepository
export const tenantCandidateRepository: TenantCandidateRepository = supabaseTenantCandidateRepository
export const rentalTermsRepository: RentalTermsRepository = supabaseRentalTermsRepository
