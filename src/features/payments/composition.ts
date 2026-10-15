import type { PaymentRepository } from './domain/payment.types'
import { supabasePaymentRepository } from './infrastructure/supabase-payment.repository'

/**
 * The one place that decides which repository implementation this feature's
 * port gets. application/ depends on this binding, never on the concrete
 * adapter's import path - same pattern as features/charges/composition.ts.
 */
export const paymentRepository: PaymentRepository = supabasePaymentRepository
