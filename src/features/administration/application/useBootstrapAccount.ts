import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { BootstrapAccountInput } from '../domain/administration.types'
import { accountRepository } from '../composition'
import { administrationQueryKeys } from './administration-query-keys'

/**
 * Bootstraps the current person's Account (and, on first run, an
 * Administration + OWNER membership). On success, invalidates both the
 * account and the accessible-administrations list - a fresh bootstrap
 * creates a new Administration, so the list is stale too, not just the
 * account. Navigation after success is the caller's responsibility.
 */
export function useBootstrapAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: BootstrapAccountInput) => accountRepository.bootstrapAccount(input),
    onSuccess: () => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: administrationQueryKeys.account }),
        queryClient.invalidateQueries({ queryKey: administrationQueryKeys.accessibleAdministrations }),
      ])
    },
  })
}
