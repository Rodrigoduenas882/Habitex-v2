import { useMutation, useQueryClient } from '@tanstack/react-query'
import { contractRepository } from '../composition'
import { contractQueryKeys } from './contract-query-keys'

export interface TerminateContractInput {
  administrationId: string
  rentalRelationshipId: string
  contractId: string
}

/**
 * Terminates a SIGNED contract via the guarded direct UPDATE (see
 * ContractRepository.terminate's own doc comment - no RPC exists for this
 * transition, and only SIGNED -> TERMINATED is supported). On success,
 * invalidates this relationship's contracts list.
 */
export function useTerminateContract() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: TerminateContractInput) => contractRepository.terminate(input.contractId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: contractQueryKeys.list(variables.administrationId, variables.rentalRelationshipId),
      })
    },
  })
}
