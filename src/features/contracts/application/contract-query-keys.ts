/**
 * Scoped by administrationId and rentalRelationshipId, same nesting
 * convention as rentalQueryKeys.terms
 * (features/rentals/application/rental-query-keys.ts) - a contract always
 * belongs to exactly one rental relationship, so its list key nests under
 * that relationship's own path.
 */
export const contractQueryKeys = {
  list: (administrationId: string, rentalRelationshipId: string) =>
    ['administration', administrationId, 'rentals', rentalRelationshipId, 'contracts'] as const,
}
