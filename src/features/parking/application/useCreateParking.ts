import { useMutation } from '@tanstack/react-query'
import type { CreateParkingInput } from '../domain/parking.types'
import { parkingRepository } from '../composition'

/**
 * Creates a parking. No query invalidation here on purpose:
 * create_parking_asset only writes to parkings/rental_subjects, never to
 * properties, so invalidating ['administration', administrationId,
 * 'properties'] would be a false invalidation of data that didn't change.
 * No Parking read query exists yet either (see ParkingRepository's doc
 * comment) - there is nothing to invalidate.
 */
export function useCreateParking() {
  return useMutation({
    mutationFn: (input: CreateParkingInput) => parkingRepository.create(input),
  })
}
