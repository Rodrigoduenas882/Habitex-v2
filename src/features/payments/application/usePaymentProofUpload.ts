import { useMutation } from '@tanstack/react-query'
import { fileRepository } from '@/features/documents/composition'
import type { FileMetadata, FilePurpose } from '@/features/documents/domain/file.types'

export interface UploadPaymentProofInput {
  administrationId: string
  rentalRelationshipId: string
  blob: Blob
  originalName: string | null
}

/**
 * Thin wrapper around fileRepository.upload (INC-010's generic primitive,
 * reused here - never duplicated), always targeting purpose 'PAYMENT_PROOF'
 * and bucket 'documents' (the 'receipts' bucket is reserved for INC-015's
 * own receipt files, not payment proof) - same shape as
 * useUploadContractFile.
 *
 * Deliberately its own, separate mutation with no onSuccess invalidation -
 * uploading a proof file doesn't change the payments list by itself, only
 * useReportPayment's success does that. The presentation layer holds the
 * resulting FileMetadata (its `id`) and passes it as `proofFileId` to
 * useReportPayment separately.
 */
export function usePaymentProofUpload() {
  return useMutation<FileMetadata, unknown, UploadPaymentProofInput>({
    mutationFn: (input: UploadPaymentProofInput) => {
      const purpose: FilePurpose = 'PAYMENT_PROOF'
      return fileRepository.upload({
        administrationId: input.administrationId,
        rentalRelationshipId: input.rentalRelationshipId,
        purpose,
        bucket: 'documents',
        blob: input.blob,
        originalName: input.originalName,
      })
    },
  })
}
