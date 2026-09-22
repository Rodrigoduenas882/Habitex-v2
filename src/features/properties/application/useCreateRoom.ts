import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateRoomInput } from '../domain/room.types'
import { roomRepository } from '../composition'
import { roomQueryKeys } from './room-query-keys'

/**
 * Creates a room for a BY_ROOMS property. On success, invalidates that
 * property's real rooms list (roomQueryKeys.list, scoped by the
 * propertyId from the submitted input) so useRooms refetches - the backend
 * stays the single source of truth for "how many rooms exist", never a
 * local array.
 *
 * TError is left as the default (Error) rather than spelling out
 * RoomRepositoryError here - roomRepository.createForProperty only ever
 * rejects with one, so callers that need `.code` narrow it at the point of
 * use (see RoomSetupPage).
 */
export function useCreateRoom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateRoomInput) => roomRepository.createForProperty(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: roomQueryKeys.list(variables.propertyId) })
    },
  })
}
