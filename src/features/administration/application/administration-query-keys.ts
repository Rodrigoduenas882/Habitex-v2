/**
 * Deliberately not under ['auth', ...] - AuthSessionListener sweeps every
 * key not in the 'auth' namespace on logout/identity change (see its own
 * doc comment), so these get cleaned up automatically without any extra
 * code here.
 *
 * Also deliberately not under ['administration', id, ...] - that shape
 * (see queryClient.ts) is for business data already scoped to a *resolved*
 * administrationId. These queries are what produce that id in the first
 * place, so they live in their own top-level namespaces.
 */
export const administrationQueryKeys = {
  account: ['account'] as const,
  accessibleAdministrations: ['administrations', 'accessible'] as const,
}
