import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rentalRepository } from '../composition'
import { rentalQueryKeys } from './rental-query-keys'

export interface CancelDraftRentalInput {
  administrationId: string
  relationshipId: string
}

/**
 * Cancels a DRAFT rental relationship via cancel_draft_rental
 * (RentalRepository.cancelDraft). On success, invalidates that
 * administration's real rentals list (rentalQueryKeys.list, scoped by the
 * administrationId carried in the mutation variables) so /rentals reflects
 * the new CANCELLED status - same pattern as useActivateRental.
 *
 * TError is left as the default (Error) rather than spelling out
 * RentalLifecycleError here - rentalRepository.cancelDraft only ever
 * rejects with one, so callers that need `.code` narrow it at the point of
 * use (see RentalsPage), same pattern as useActivateRental.
 */
export function useCancelDraftRental() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CancelDraftRentalInput) => rentalRepository.cancelDraft(input.relationshipId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: rentalQueryKeys.list(variables.administrationId) })
    },
  })
}
