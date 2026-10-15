import { describe, expect, it } from 'vitest'
import type { Payment, PaymentAllocation } from '../domain/payment.types'
import { summarizePaymentAllocations } from './payment-allocation-summary'

const PAYMENT: Payment = {
  id: 'payment-1',
  administrationId: 'admin-1',
  rentalRelationshipId: 'rel-1',
  reportedByPersonId: 'person-1',
  confirmedByPersonId: 'person-2',
  status: 'CONFIRMED',
  amount: 1_000_000,
  currency: 'COP',
  paymentDate: '2026-01-05',
  paymentMethod: 'BANK_TRANSFER',
  externalReference: null,
  proofFileId: null,
  notes: null,
  reportedAt: '2026-01-05T10:00:00Z',
  confirmedAt: '2026-01-06T10:00:00Z',
  rejectedAt: null,
  rejectionReason: null,
  createdAt: '2026-01-05T10:00:00Z',
  updatedAt: '2026-01-06T10:00:00Z',
}

function allocation(overrides: Partial<PaymentAllocation>): PaymentAllocation {
  return {
    id: 'allocation-1',
    administrationId: 'admin-1',
    paymentId: 'payment-1',
    chargeId: 'charge-1',
    amount: 100_000,
    createdAt: '2026-01-06T10:00:00Z',
    ...overrides,
  }
}

describe('summarizePaymentAllocations', () => {
  it('returns allocatedAmount 0 and remainingAmount equal to payment.amount when there are no allocations', () => {
    expect(summarizePaymentAllocations(PAYMENT, [])).toEqual({ allocatedAmount: 0, remainingAmount: 1_000_000 })
  })

  it('sums multiple allocations correctly', () => {
    const allocations = [
      allocation({ id: 'allocation-1', chargeId: 'charge-1', amount: 300_000 }),
      allocation({ id: 'allocation-2', chargeId: 'charge-2', amount: 250_000 }),
    ]

    expect(summarizePaymentAllocations(PAYMENT, allocations)).toEqual({ allocatedAmount: 550_000, remainingAmount: 450_000 })
  })

  it('returns remainingAmount 0 when the payment is fully allocated', () => {
    const allocations = [
      allocation({ id: 'allocation-1', chargeId: 'charge-1', amount: 600_000 }),
      allocation({ id: 'allocation-2', chargeId: 'charge-2', amount: 400_000 }),
    ]

    expect(summarizePaymentAllocations(PAYMENT, allocations)).toEqual({ allocatedAmount: 1_000_000, remainingAmount: 0 })
  })
})
