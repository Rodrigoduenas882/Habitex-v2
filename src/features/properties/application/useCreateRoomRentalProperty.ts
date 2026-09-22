import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreatePropertyInput } from '../domain/property.types'
import { propertyRepository } from '../composition'
import { propertyQueryKeys } from './property-query-keys'

/**
 * Creates a BY_ROOMS property. On success, invalidates the administration's
 * properties list and resolves the created Property (its id is needed to
 * navigate to /properties/:propertyId/rooms/setup) - navigation itself is
 * the caller's responsibility.
 */
export function useCreateRoomRentalProperty(administrationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Omit<CreatePropertyInput, 'administrationId'>) =>
      propertyRepository.createRoomRentalProperty({ ...input, administrationId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: propertyQueryKeys.list(administrationId) })
    },
  })
}
