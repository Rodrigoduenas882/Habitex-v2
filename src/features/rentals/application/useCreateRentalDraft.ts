import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateRentalDraftInput } from '../domain/rental.types'
import { rentalRepository } from '../composition'
import { rentalQueryKeys } from './rental-query-keys'

/**
 * Creates the initial DRAFT of a RentalRelationship via create_rental_draft.
 * On success, invalidates that administration's real rentals list
 * (rentalQueryKeys.list, scoped by the administrationId from the submitted
 * input) so /rentals shows the new DRAFT once the caller redirects there -
 * /rentals/:id/setup doesn't exist yet, so success routes back to /rentals
 * instead of a page that would 404.
 */
export function useCreateRentalDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateRentalDraftInput) => rentalRepository.createDraft(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: rentalQueryKeys.list(variables.administrationId) })
    },
  })
}
