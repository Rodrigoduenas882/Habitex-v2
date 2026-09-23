import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rentalRepository } from '../composition'
import { rentalQueryKeys } from './rental-query-keys'

export interface ActivateRentalInput {
  administrationId: string
  relationshipId: string
}

/**
 * Activates a DRAFT rental relationship via activate_rental_relationship
 * (RentalRepository.activate). On success, invalidates that
 * administration's real rentals list (rentalQueryKeys.list, scoped by the
 * administrationId carried in the mutation variables, same pattern as
 * useCreateRentalDraft) so /rentals reflects the new ACTIVE status.
 *
 * TError is left as the default (Error) rather than spelling out
 * RentalActivationError here - rentalRepository.activate only ever rejects
 * with one, so callers that need `.code` narrow it at the point of use (see
 * RentalsPage), same pattern as useCreateRoom/RoomSetupPage.
 */
export function useActivateRental() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ActivateRentalInput) => rentalRepository.activate(input.relationshipId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: rentalQueryKeys.list(variables.administrationId) })
    },
  })
}
