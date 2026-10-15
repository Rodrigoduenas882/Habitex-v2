import { useQuery } from '@tanstack/react-query'
import { subscriptionRepository } from '../composition'
import { administrationQueryKeys } from './administration-query-keys'

/**
 * The subscription of `administrationId`, or null if no subscription row
 * exists yet for it. Pass null/undefined while the current administration
 * isn't resolved yet - the query stays disabled and never fetches until a
 * real id is available.
 */
export function useSubscription(administrationId: string | null | undefined) {
  return useQuery({
    queryKey: administrationQueryKeys.subscription(administrationId ?? 'pending'),
    queryFn: () => {
      if (!administrationId) {
        throw new Error('useSubscription: called without a resolved administrationId')
      }
      return subscriptionRepository.getSubscription(administrationId)
    },
    enabled: Boolean(administrationId),
  })
}
