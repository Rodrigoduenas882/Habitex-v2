/**
 * Scoped by administrationId, same principle as
 * features/properties/application/property-query-keys.ts and
 * features/parking/application/parking-query-keys.ts.
 */
export const rentalQueryKeys = {
  list: (administrationId: string) => ['administration', administrationId, 'rentals'] as const,
  terms: (administrationId: string, relationshipId: string) =>
    ['administration', administrationId, 'rentals', relationshipId, 'terms'] as const,
}
