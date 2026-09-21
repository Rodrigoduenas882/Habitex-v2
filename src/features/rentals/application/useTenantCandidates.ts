import { useQuery } from '@tanstack/react-query'
import { tenantCandidateRepository } from '../composition'
import { tenantCandidateQueryKeys } from './tenant-candidate-query-keys'

/** Lists the people already linked to `administrationId`, for the "persona existente" tenant option. */
export function useTenantCandidates(administrationId: string | undefined) {
  return useQuery({
    queryKey: tenantCandidateQueryKeys.list(administrationId ?? 'pending'),
    queryFn: () => {
      if (!administrationId) {
        throw new Error('useTenantCandidates: called without a resolved administrationId')
      }
      return tenantCandidateRepository.listByAdministration(administrationId)
    },
    enabled: administrationId != null,
  })
}
