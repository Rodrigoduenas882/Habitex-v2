/**
 * Scoped by administrationId and rentalRelationshipId, same nesting
 * convention as contractQueryKeys.list
 * (features/contracts/application/contract-query-keys.ts) - a charge always
 * belongs to exactly one rental relationship, so its list key nests under
 * that relationship's own path.
 */
export const chargeQueryKeys = {
  list: (administrationId: string, rentalRelationshipId: string) =>
    ['administration', administrationId, 'rentals', rentalRelationshipId, 'charges'] as const,
}
