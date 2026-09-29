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
  /**
   * Administration-wide, bounded by a `[from, toExclusive)` due_date range -
   * not nested under a single relationship's own path (unlike `list`)
   * because Dashboard financials need every RENT charge across the
   * administration for a given month window, not one relationship's.
   */
  listByAdministration: (administrationId: string, range: { from: string; toExclusive: string }) =>
    ['administration', administrationId, 'charges', 'range', range.from, range.toExclusive] as const,
}
