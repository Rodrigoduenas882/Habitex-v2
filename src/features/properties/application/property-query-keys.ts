/**
 * Scoped by administrationId, as required by queryClient.ts's namespacing
 * rule ("administration", administrationId, resource) - never a bare
 * ["properties"] key.
 */
export const propertyQueryKeys = {
  list: (administrationId: string) => ['administration', administrationId, 'properties'] as const,
}
