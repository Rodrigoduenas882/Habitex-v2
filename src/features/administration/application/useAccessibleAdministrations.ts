import { useQuery } from '@tanstack/react-query'
import { administrationRepository } from '../composition'
import { administrationQueryKeys } from './administration-query-keys'

/**
 * The administrations the current person can access. Not gated on
 * useAccount() resolving first - RLS scopes this query server-side via the
 * authenticated session alone, so both queries can run in parallel.
 */
export function useAccessibleAdministrations() {
  return useQuery({
    queryKey: administrationQueryKeys.accessibleAdministrations,
    queryFn: () => administrationRepository.listAccessibleAdministrations(),
  })
}
