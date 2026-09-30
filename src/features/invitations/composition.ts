import type { InvitationRepository } from './domain/invitation.types'
import { supabaseInvitationRepository } from './infrastructure/supabase-invitation.repository'

/**
 * The one place that decides which repository implementation this feature's
 * port gets. application/ depends on this binding, never on the concrete
 * adapter's import path - same pattern as features/payments/composition.ts.
 */
export const invitationRepository: InvitationRepository = supabaseInvitationRepository
