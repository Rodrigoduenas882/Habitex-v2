import type { Payment, PaymentAllocation } from '../domain/payment.types'

export interface PaymentAllocationSummary {
  allocatedAmount: number
  remainingAmount: number
}

/**
 * Pure allocation math for a single payment - no I/O, no React Query, so the
 * presentation layer (and its own tests) can call it directly without
 * mocking anything. `remainingAmount` mirrors allocate_payment's own
 * ALLOCATION_EXCEEDS_PAYMENT guard (payment.amount minus the sum of its
 * allocations), it does not re-derive or enforce that guard itself.
 */
export function summarizePaymentAllocations(payment: Payment, allocations: PaymentAllocation[]): PaymentAllocationSummary {
  const allocatedAmount = allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
  return { allocatedAmount, remainingAmount: payment.amount - allocatedAmount }
}
