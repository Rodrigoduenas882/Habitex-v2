import { useQuery } from '@tanstack/react-query'
import { roomRepository } from '../composition'
import { roomQueryKeys } from './room-query-keys'

/**
 * Lists the real rooms of `propertyId` - the backend authority
 * RoomSetupPage uses to decide whether "Terminar configuración" can be
 * enabled, including after a refresh. Pass `undefined` while propertyId
 * isn't known yet; the query stays disabled and never fetches.
 */
export function useRooms(propertyId: string | undefined) {
  return useQuery({
    queryKey: roomQueryKeys.list(propertyId ?? 'pending'),
    queryFn: () => {
      if (!propertyId) {
        throw new Error('useRooms: called without a propertyId')
      }
      return roomRepository.listByProperty(propertyId)
    },
    enabled: propertyId != null,
  })
}
