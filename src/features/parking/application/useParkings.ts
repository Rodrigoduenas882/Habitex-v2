import { useQuery } from '@tanstack/react-query'
import { parkingRepository } from '../composition'
import { parkingQueryKeys } from './parking-query-keys'

/**
 * Lists the parkings of `administrationId`. Pass `undefined` while the
 * current administration isn't resolved yet - the query stays disabled and
 * never fetches until a real id is available (same pattern as useProperties).
 */
export function useParkings(administrationId: string | undefined) {
  return useQuery({
    queryKey: parkingQueryKeys.list(administrationId ?? 'pending'),
    queryFn: () => {
      if (!administrationId) {
        throw new Error('useParkings: called without a resolved administrationId')
      }
      return parkingRepository.listByAdministration(administrationId)
    },
    enabled: administrationId != null,
  })
}
