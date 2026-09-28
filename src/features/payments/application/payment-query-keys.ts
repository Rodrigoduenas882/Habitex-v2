/**
 * Scoped by administrationId and rentalRelationshipId, same nesting
 * convention as chargeQueryKeys.list
 * (features/charges/application/charge-query-keys.ts) - a payment always
 * belongs to exactly one rental relationship, so its list key nests under
 * that relationship's own path.
 */
export const paymentQueryKeys = {
  list: (administrationId: string, rentalRelationshipId: string) =>
    ['administration', administrationId, 'rentals', rentalRelationshipId, 'payments'] as const,
}
