import { useMutation, useQueryClient } from '@tanstack/react-query'
import { contractRepository } from '../composition'
import { contractQueryKeys } from './contract-query-keys'

export interface AttachSignedCopyInput {
  administrationId: string
  rentalRelationshipId: string
  contractId: string
  signedFileId: string
}

/**
 * Attaches a signed copy to an existing GENERATED/SHARED HABITEX contract
 * via attach_signed_contract_copy (ContractRepository.attachSignedCopy),
 * transitioning it to SIGNED. Takes an already-known signedFileId, never a
 * blob - same upload-then-register separation as the two registration
 * hooks.
 *
 * On success, invalidates this relationship's contracts list.
 */
export function useAttachSignedCopy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AttachSignedCopyInput) =>
      contractRepository.attachSignedCopy(input.contractId, input.signedFileId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: contractQueryKeys.list(variables.administrationId, variables.rentalRelationshipId),
      })
    },
  })
}
