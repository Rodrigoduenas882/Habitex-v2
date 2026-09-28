/**
 * Scoped by administrationId and rentalRelationshipId, same nesting
 * convention as chargeQueryKeys.list
 * (features/charges/application/charge-query-keys.ts) - a payment always
 * belongs to exactly one rental relationship, so its list key nests under
 * that relationship's own path.
 *
 * `allocations` additionally nests under the payment's own id, scoped by
 * administrationId per ARCHITECTURE.md §6 tenant-scoping - a payment's
 * allocations are a sub-resource of that one payment.
 *
 * `receipt` follows the exact same nesting as `allocations` - a payment's
 * (0-or-1) receipt is likewise a sub-resource of that one payment.
 */
export const paymentQueryKeys = {
  list: (administrationId: string, rentalRelationshipId: string) =>
    ['administration', administrationId, 'rentals', rentalRelationshipId, 'payments'] as const,
  allocations: (administrationId: string, paymentId: string) =>
    ['administration', administrationId, 'payments', paymentId, 'allocations'] as const,
  receipt: (administrationId: string, paymentId: string) =>
    ['administration', administrationId, 'payments', paymentId, 'receipt'] as const,
}
