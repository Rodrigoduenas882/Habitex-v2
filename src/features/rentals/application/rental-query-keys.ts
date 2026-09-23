/**
 * Scoped by administrationId, same principle as
 * features/properties/application/property-query-keys.ts and
 * features/parking/application/parking-query-keys.ts.
 */
export const rentalQueryKeys = {
  list: (administrationId: string) => ['administration', administrationId, 'rentals'] as const,
  terms: (administrationId: string, relationshipId: string) =>
    ['administration', administrationId, 'rentals', relationshipId, 'terms'] as const,
  /**
   * Scoped by administrationId only, not by the ids being checked - the
   * relationship ids to check are a queryFn argument (derived fresh from
   * the already-fetched rentals list on every call), not part of the key,
   * same principle as not baking filter params into a key when the caller
   * always wants "the current one for this administration" (see
   * useRentalTermsExistence).
   */
  termsExistence: (administrationId: string) =>
    ['administration', administrationId, 'rentals', 'terms-existence'] as const,
}
