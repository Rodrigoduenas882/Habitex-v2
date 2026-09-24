import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RegisterHabitexGeneratedContractInput } from '../domain/contract.types'
import { contractRepository } from '../composition'
import { contractQueryKeys } from './contract-query-keys'

/**
 * Registers a HABITEX-generated contract via register_habitex_generated_contract
 * (ContractRepository.registerHabitexGenerated). Takes an already-known
 * documentFileId, never a blob - the upload step happens separately, first,
 * via useUploadContractFile (see that hook's own doc comment for why).
 *
 * On success, invalidates this relationship's contracts list so the new row
 * appears without a manual refetch.
 */
export function useRegisterHabitexGeneratedContract() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: RegisterHabitexGeneratedContractInput) => contractRepository.registerHabitexGenerated(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: contractQueryKeys.list(variables.administrationId, variables.rentalRelationshipId),
      })
    },
  })
}
