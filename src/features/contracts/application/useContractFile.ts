import { useQuery } from '@tanstack/react-query'
import { fileRepository } from '@/features/documents/composition'

/**
 * Resolves the full FileMetadata (bucket/path) of a contract's
 * documentFileId/signedFileId, via INC-010's fileRepository.getById -
 * needed because fileRepository.download() takes a FileMetadata, not a bare
 * id. Read-only convenience lookup for the download action - RLS on
 * public.files is what actually protects this, not how the id got fetched.
 *
 * Pass `null` for `fileId` when there is nothing to resolve (e.g. a
 * contract with no signed_file_id yet) - the query stays disabled.
 */
export function useContractFile(administrationId: string | undefined, fileId: string | null) {
  return useQuery({
    queryKey: ['administration', administrationId ?? 'pending', 'files', fileId ?? 'none'] as const,
    queryFn: () => {
      if (!fileId) {
        throw new Error('useContractFile: called without a resolved fileId')
      }
      return fileRepository.getById(fileId)
    },
    enabled: Boolean(administrationId) && Boolean(fileId),
  })
}
