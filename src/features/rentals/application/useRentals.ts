import { useQuery } from '@tanstack/react-query'
import { rentalRepository } from '../composition'
import { rentalQueryKeys } from './rental-query-keys'

/**
 * Lists the rental relationships of `administrationId`. Pass `undefined`
 * while the current administration isn't resolved yet - the query stays
 * disabled and never fetches until a real id is available (same pattern as
 * useProperties/useParkings).
 */
export function useRentals(administrationId: string | undefined) {
  return useQuery({
    queryKey: rentalQueryKeys.list(administrationId ?? 'pending'),
    queryFn: () => {
      if (!administrationId) {
        throw new Error('useRentals: called without a resolved administrationId')
      }
      return rentalRepository.listByAdministration(administrationId)
    },
    enabled: administrationId != null,
  })
}
