import { useMutation, useQueryClient } from '@tanstack/react-query'
import { contractRepository } from '../composition'
import { contractQueryKeys } from './contract-query-keys'

export interface MarkContractSharedInput {
  administrationId: string
  rentalRelationshipId: string
  contractId: string
}

/**
 * Marks a GENERATED contract as SHARED via the guarded direct UPDATE (see
 * ContractRepository.markShared's own doc comment - no RPC exists for this
 * transition). On success, invalidates this relationship's contracts list.
 */
export function useMarkContractShared() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: MarkContractSharedInput) => contractRepository.markShared(input.contractId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: contractQueryKeys.list(variables.administrationId, variables.rentalRelationshipId),
      })
    },
  })
}
