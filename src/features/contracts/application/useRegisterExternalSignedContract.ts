import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RegisterExternalSignedContractInput } from '../domain/contract.types'
import { contractRepository } from '../composition'
import { contractQueryKeys } from './contract-query-keys'

/**
 * Registers an already-executed external contract via
 * register_external_signed_contract (ContractRepository.registerExternalSigned).
 * Takes an already-known signedFileId, never a blob - same upload-then-
 * register separation as useRegisterHabitexGeneratedContract.
 *
 * On success, invalidates this relationship's contracts list.
 */
export function useRegisterExternalSignedContract() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: RegisterExternalSignedContractInput) => contractRepository.registerExternalSigned(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: contractQueryKeys.list(variables.administrationId, variables.rentalRelationshipId),
      })
    },
  })
}
