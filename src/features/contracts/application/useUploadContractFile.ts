import { useMutation } from '@tanstack/react-query'
import { fileRepository } from '@/features/documents/composition'
import type { FilePurpose } from '@/features/documents/domain/file.types'

export interface UploadContractFileInput {
  administrationId: string
  rentalRelationshipId: string
  /** Only ever 'CONTRACT_GENERATED' or 'CONTRACT_SIGNED' in this feature. */
  purpose: FilePurpose
  blob: Blob
  originalName: string | null
}

/**
 * Thin wrapper around fileRepository.upload (INC-010's generic primitive,
 * reused here - never duplicated), always targeting the 'documents' bucket.
 *
 * Deliberately its own, separate mutation - never combined with a
 * registration RPC call into a single mutationFn. See
 * RentalContractsPage's own doc comment for the full upload-then-register
 * orchestration this supports: the presentation layer holds the resulting
 * FileMetadata in local state and calls the registration mutation
 * separately, so a registration failure can be retried without calling this
 * mutation again (which would upload a second, duplicate file).
 */
export function useUploadContractFile() {
  return useMutation({
    mutationFn: (input: UploadContractFileInput) =>
      fileRepository.upload({
        administrationId: input.administrationId,
        rentalRelationshipId: input.rentalRelationshipId,
        purpose: input.purpose,
        bucket: 'documents',
        blob: input.blob,
        originalName: input.originalName,
      }),
  })
}
