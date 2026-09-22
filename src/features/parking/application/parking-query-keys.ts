/**
 * Scoped by administrationId, same principle as
 * features/properties/application/property-query-keys.ts.
 */
export const parkingQueryKeys = {
  list: (administrationId: string) => ['administration', administrationId, 'parkings'] as const,
}
