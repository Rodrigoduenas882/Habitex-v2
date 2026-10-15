import { useQuery } from '@tanstack/react-query'
import { roomRepository } from '../composition'
import { roomQueryKeys } from './room-query-keys'

/**
 * Lists every room of `administrationId`, across all of its properties -
 * unlike useRooms (scoped to a single property), this is the administration-
 * wide read Dashboard occupancy needs. Pass `undefined` while the current
 * administration isn't resolved yet - the query stays disabled and never
 * fetches until a real id is available (same pattern as useProperties/
 * useRooms).
 */
export function useAdministrationRooms(administrationId: string | undefined) {
  return useQuery({
    queryKey: roomQueryKeys.byAdministration(administrationId ?? 'pending'),
    queryFn: () => {
      if (!administrationId) {
        throw new Error('useAdministrationRooms: called without a resolved administrationId')
      }
      return roomRepository.listByAdministration(administrationId)
    },
    enabled: administrationId != null,
  })
}
