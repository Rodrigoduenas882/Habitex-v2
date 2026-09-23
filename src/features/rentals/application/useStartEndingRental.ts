import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rentalRepository } from '../composition'
import { rentalQueryKeys } from './rental-query-keys'

export interface StartEndingRentalInput {
  administrationId: string
  relationshipId: string
}

/**
 * Moves an ACTIVE rental relationship into ENDING via start_ending_rental
 * (RentalRepository.startEnding). On success, invalidates that
 * administration's real rentals list (rentalQueryKeys.list, scoped by the
 * administrationId carried in the mutation variables) so /rentals reflects
 * the new ENDING status - same pattern as useActivateRental.
 *
 * TError is left as the default (Error) rather than spelling out
 * RentalLifecycleError here - rentalRepository.startEnding only ever
 * rejects with one, so callers that need `.code` narrow it at the point of
 * use (see RentalsPage), same pattern as useActivateRental.
 */
export function useStartEndingRental() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: StartEndingRentalInput) => rentalRepository.startEnding(input.relationshipId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: rentalQueryKeys.list(variables.administrationId) })
    },
  })
}
