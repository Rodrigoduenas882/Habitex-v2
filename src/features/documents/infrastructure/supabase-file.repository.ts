import { supabaseClient } from '@/infrastructure/supabase/client'
import { buildStoragePath } from '../domain/storage-path'
import {
  FileRepositoryError,
  type FileMetadata,
  type FilePurpose,
  type FileRepository,
  type FileStorageBucket,
  type UploadFileInput,
} from '../domain/file.types'

interface FileRow {
  id: string
  administration_id: string
  rental_relationship_id: string | null
  purpose: FilePurpose
  storage_bucket: FileStorageBucket
  storage_path: string
  original_name: string | null
  mime_type: string
  size_bytes: number
  sha256: string | null
  uploaded_by_person_id: string | null
  created_at: string
}

const FILE_COLUMNS =
  'id, administration_id, rental_relationship_id, purpose, storage_bucket, storage_path, original_name, mime_type, size_bytes, sha256, uploaded_by_person_id, created_at'

function toFileMetadata(row: FileRow): FileMetadata {
  return {
    id: row.id,
    administrationId: row.administration_id,
    rentalRelationshipId: row.rental_relationship_id,
    purpose: row.purpose,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    uploadedByPersonId: row.uploaded_by_person_id,
    createdAt: row.created_at,
  }
}

export const supabaseFileRepository: FileRepository = {
  async upload(input: UploadFileInput): Promise<FileMetadata> {
    const path = buildStoragePath(input.administrationId, input.blob, input.originalName)

    // upsert: false is required, not just a default - storage.objects has no
    // UPDATE policy (objects are immutable), so upsert: true would always be
    // denied by RLS. path is freshly generated above, so this never
    // collides with an existing object.
    const { error: uploadError } = await supabaseClient.storage.from(input.bucket).upload(path, input.blob, {
      contentType: input.blob.type,
      upsert: false,
    })

    if (uploadError) {
      // Nothing was created - safe to retry the whole upload from scratch.
      throw new FileRepositoryError('Failed to upload the file to storage', uploadError)
    }

    const { data, error: insertError } = await supabaseClient
      .from('files')
      .insert({
        administration_id: input.administrationId,
        rental_relationship_id: input.rentalRelationshipId,
        purpose: input.purpose,
        storage_bucket: input.bucket,
        storage_path: path,
        original_name: input.originalName,
        mime_type: input.blob.type,
        size_bytes: input.blob.size,
      })
      .select(FILE_COLUMNS)
      .single()

    if (insertError) {
      // The storage object was created but its metadata row was not - a
      // best-effort compensating cleanup, not a distributed transaction.
      // Its own outcome (success or failure) is deliberately ignored: a
      // cleanup failure must never mask the original metadata-insert error
      // thrown below, and is never retried. A residual orphaned object (if
      // this cleanup itself also fails) is an accepted, documented
      // limitation of this increment.
      try {
        await supabaseClient.storage.from(input.bucket).remove([path])
      } catch {
        // best-effort only - see comment above.
      }

      throw new FileRepositoryError('Failed to create the file metadata record', insertError)
    }

    return toFileMetadata(data)
  },

  async download(file: FileMetadata): Promise<Blob> {
    const { data, error } = await supabaseClient.storage.from(file.storageBucket).download(file.storagePath)

    if (error) {
      throw new FileRepositoryError('Failed to download the file', error)
    }

    return data
  },

  async remove(file: FileMetadata): Promise<void> {
    const { error: deleteError } = await supabaseClient.from('files').delete().eq('id', file.id)

    if (deleteError) {
      // Nothing should be removed if the operation the user actually asked
      // for (deleting the file record) did not succeed.
      throw new FileRepositoryError('Failed to delete the file metadata record', deleteError)
    }

    // The metadata row is already gone at this point, so from the user's
    // perspective the delete has already "succeeded" (see
    // FileRepository.remove's own doc comment) - nothing in the app can
    // discover or display this storage object anymore. Even so, a failure
    // here still surfaces via FileRepositoryError rather than being
    // swallowed: this app's rule is that a remote error is never absorbed
    // into a silent local success (ARCHITECTURE.md §7), and the caller
    // should know the cleanup was not fully clean, even though the metadata
    // row is already gone.
    const { error: removeError } = await supabaseClient.storage.from(file.storageBucket).remove([file.storagePath])

    if (removeError) {
      throw new FileRepositoryError(
        'The file metadata record was deleted, but removing the storage object failed',
        removeError,
      )
    }
  },
}
