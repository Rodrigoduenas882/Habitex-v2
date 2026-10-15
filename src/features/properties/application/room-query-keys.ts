/**
 * Scoped by propertyId, not administrationId - rooms belong to a single
 * property, and nothing here needs the "administration"-scoped shape from
 * queryClient.ts (that rule is for business data scoped to a *resolved*
 * administrationId; this is a sub-resource of a single property instead).
 */
export const roomQueryKeys = {
  list: (propertyId: string) => ['property', propertyId, 'rooms'] as const,
  /**
   * Administration-wide, per ARCHITECTURE.md §6 tenant-scoping - unlike
   * `list` above (scoped by a single property), this reads every room the
   * administration owns (e.g. for Dashboard occupancy).
   */
  byAdministration: (administrationId: string) => ['administration', administrationId, 'rooms'] as const,
}
