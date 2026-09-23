import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rentalRepository } from '../composition'
import { rentalQueryKeys } from './rental-query-keys'

export interface EndRentalInput {
  administrationId: string
  relationshipId: string
}

/**
 * Ends an ACTIVE or ENDING rental relationship via end_rental
 * (RentalRepository.end) - always called with only relationshipId, never a
 * date, so the RPC's own DEFAULT CURRENT_DATE applies (see
 * RentalRepository.end's own doc comment). On success, invalidates that
 * administration's real rentals list (rentalQueryKeys.list, scoped by the
 * administrationId carried in the mutation variables) so /rentals reflects
 * the new ENDED status - same pattern as useActivateRental.
 *
 * TError is left as the default (Error) rather than spelling out
 * RentalLifecycleError here - rentalRepository.end only ever rejects with
 * one, so callers that need `.code` narrow it at the point of use (see
 * RentalsPage), same pattern as useActivateRental.
 */
export function useEndRental() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: EndRentalInput) => rentalRepository.end(input.relationshipId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: rentalQueryKeys.list(variables.administrationId) })
    },
  })
}
