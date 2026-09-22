import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateParkingInput } from '../domain/parking.types'
import { parkingRepository } from '../composition'
import { parkingQueryKeys } from './parking-query-keys'

/**
 * Creates a parking. On success, invalidates that administration's real
 * parkings list (parkingQueryKeys.list, scoped by the administrationId from
 * the submitted input) so useParkings refetches.
 *
 * Still never invalidates properties: create_parking_asset only writes to
 * parkings/rental_subjects, never to properties, so invalidating
 * ['administration', administrationId, 'properties'] would be a false
 * invalidation of data that didn't change.
 */
export function useCreateParking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateParkingInput) => parkingRepository.create(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: parkingQueryKeys.list(variables.administrationId) })
    },
  })
}
