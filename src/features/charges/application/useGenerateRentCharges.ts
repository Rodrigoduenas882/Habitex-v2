import { useMutation, useQueryClient } from '@tanstack/react-query'
import { chargeRepository } from '../composition'
import { chargeQueryKeys } from './charge-query-keys'

export interface GenerateRentChargesInput {
  administrationId: string
  rentalRelationshipId: string
}

/**
 * Generates RENT charges via generate_rent_charges (see
 * ChargeRepository.generateRentCharges's own doc comment - idempotent,
 * called with only the relationship id, a zero-row result is a normal
 * successful outcome). On success, invalidates this relationship's charges
 * list so the newly-created rows (if any) show up without a manual refetch.
 */
export function useGenerateRentCharges() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: GenerateRentChargesInput) => chargeRepository.generateRentCharges(input.rentalRelationshipId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: chargeQueryKeys.list(variables.administrationId, variables.rentalRelationshipId),
      })
    },
  })
}
