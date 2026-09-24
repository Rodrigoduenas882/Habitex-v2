import { describe, expect, it, vi } from 'vitest'
import { FileRepositoryError, type FileMetadata, type UploadFileInput } from '../domain/file.types'

// Note: these are unit tests of this adapter's own logic (correct Storage
// and public.files calls, correct sequencing, correct error propagation) -
// they do not, and cannot, prove the deployed storage.objects/files RLS
// policies actually enforce anything. That is verified separately, live,
// via the read-only Supabase MCP.
const { from, eqFilter, deleteFn, insert, single, storageFrom, storageUpload, storageDownload, storageRemove } =
  vi.hoisted(() => {
    const single = vi.fn()
    const insertSelect = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select: insertSelect }))
    const deleteFn = vi.fn<() => unknown>()
    const eqFilter = vi.fn(() => deleteFn())
    const from = vi.fn((_table: string) => ({
      insert,
      delete: () => ({ eq: eqFilter }),
    }))

    const storageUpload = vi.fn()
    const storageDownload = vi.fn()
    const storageRemove = vi.fn()
    const storageFrom = vi.fn((_bucket: string) => ({
      upload: storageUpload,
      download: storageDownload,
      remove: storageRemove,
    }))

    return {
      from,
      eqFilter,
      deleteFn,
      insert,
      single,
      storageFrom,
      storageUpload,
      storageDownload,
      storageRemove,
    }
  })

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: { from, storage: { from: storageFrom } },
}))

import { supabaseFileRepository } from './supabase-file.repository'

const FILE_ROW = {
  id: 'file-1',
  administration_id: 'admin-1',
  rental_relationship_id: null,
  purpose: 'RECEIPT',
  storage_bucket: 'receipts',
  storage_path: 'admin-1/some-uuid.pdf',
  original_name: 'boleta.pdf',
  mime_type: 'application/pdf',
  size_bytes: 4,
  sha256: null,
  uploaded_by_person_id: null,
  created_at: '2026-01-01T00:00:00Z',
}

const UPLOAD_INPUT: UploadFileInput = {
  administrationId: 'admin-1',
  rentalRelationshipId: null,
  purpose: 'RECEIPT',
  bucket: 'receipts',
  blob: new Blob(['data'], { type: 'application/pdf' }),
  originalName: 'boleta.pdf',
}

const FILE_METADATA: FileMetadata = {
  id: 'file-1',
  administrationId: 'admin-1',
  rentalRelationshipId: null,
  purpose: 'RECEIPT',
  storageBucket: 'receipts',
  storagePath: 'admin-1/some-uuid.pdf',
  originalName: 'boleta.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 4,
  sha256: null,
  uploadedByPersonId: null,
  createdAt: '2026-01-01T00:00:00Z',
}

describe('supabaseFileRepository.upload', () => {
  it('calls Storage upload with upsert: false and the exact contentType, then inserts the matching files row', async () => {
    let uploadedPath = ''
    let uploadedOptions: unknown
    storageUpload.mockImplementationOnce((path: string, _blob: Blob, options: unknown) => {
      uploadedPath = path
      uploadedOptions = options
      return Promise.resolve({ data: { path }, error: null })
    })
    single.mockResolvedValueOnce({ data: FILE_ROW, error: null })

    const result = await supabaseFileRepository.upload(UPLOAD_INPUT)

    expect(storageFrom).toHaveBeenCalledWith('receipts')
    expect(uploadedPath.startsWith('admin-1/')).toBe(true)
    expect(uploadedPath.endsWith('.pdf')).toBe(true)
    expect(uploadedOptions).toEqual({ contentType: 'application/pdf', upsert: false })

    expect(from).toHaveBeenCalledWith('files')
    expect(insert).toHaveBeenCalledWith({
      administration_id: 'admin-1',
      rental_relationship_id: null,
      purpose: 'RECEIPT',
      storage_bucket: 'receipts',
      storage_path: uploadedPath,
      original_name: 'boleta.pdf',
      mime_type: 'application/pdf',
      size_bytes: 4,
    })

    expect(result).toEqual(FILE_METADATA)
  })

  it('throws FileRepositoryError and never attempts the files insert when the Storage upload fails', async () => {
    storageUpload.mockResolvedValueOnce({ data: null, error: { message: 'storage boom' } })

    await expect(supabaseFileRepository.upload(UPLOAD_INPUT)).rejects.toBeInstanceOf(FileRepositoryError)

    expect(insert).not.toHaveBeenCalled()
  })

  it('attempts a compensating storage removal and still throws the original metadata error when the files insert fails after a successful upload', async () => {
    let uploadedPath = ''
    storageUpload.mockImplementationOnce((path: string) => {
      uploadedPath = path
      return Promise.resolve({ data: { path }, error: null })
    })
    single.mockResolvedValueOnce({ data: null, error: { message: 'metadata boom' } })
    storageRemove.mockResolvedValueOnce({ data: null, error: null })

    const error = await supabaseFileRepository.upload(UPLOAD_INPUT).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(FileRepositoryError)
    expect((error as FileRepositoryError).message).toBe('Failed to create the file metadata record')
    expect((error as FileRepositoryError).cause).toEqual({ message: 'metadata boom' })

    expect(storageRemove).toHaveBeenCalledWith([uploadedPath])
  })

  it('still throws the original metadata error, not a cleanup error, when the compensating removal itself fails', async () => {
    storageUpload.mockResolvedValueOnce({ data: { path: 'admin-1/some-uuid.pdf' }, error: null })
    single.mockResolvedValueOnce({ data: null, error: { message: 'metadata boom' } })
    storageRemove.mockRejectedValueOnce(new Error('cleanup also failed'))

    const error = await supabaseFileRepository.upload(UPLOAD_INPUT).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(FileRepositoryError)
    expect((error as FileRepositoryError).message).toBe('Failed to create the file metadata record')
  })
})

describe('supabaseFileRepository.download', () => {
  it('calls Storage download with the exact bucket/path from the given FileMetadata and returns the blob', async () => {
    const blob = new Blob(['bytes'])
    storageDownload.mockResolvedValueOnce({ data: blob, error: null })

    const result = await supabaseFileRepository.download(FILE_METADATA)

    expect(storageFrom).toHaveBeenCalledWith('receipts')
    expect(storageDownload).toHaveBeenCalledWith('admin-1/some-uuid.pdf')
    expect(result).toBe(blob)
  })

  it('wraps a Storage download failure in FileRepositoryError', async () => {
    storageDownload.mockResolvedValueOnce({ data: null, error: { message: 'download boom' } })

    await expect(supabaseFileRepository.download(FILE_METADATA)).rejects.toBeInstanceOf(FileRepositoryError)
  })
})

describe('supabaseFileRepository.remove', () => {
  it('deletes the public.files row before attempting the storage removal', async () => {
    const callOrder: string[] = []
    deleteFn.mockImplementationOnce(() => {
      callOrder.push('metadata-delete')
      return { data: null, error: null }
    })
    storageRemove.mockImplementationOnce(() => {
      callOrder.push('storage-remove')
      return Promise.resolve({ data: null, error: null })
    })

    await supabaseFileRepository.remove(FILE_METADATA)

    expect(from).toHaveBeenCalledWith('files')
    expect(eqFilter).toHaveBeenCalledWith('id', 'file-1')
    expect(storageFrom).toHaveBeenCalledWith('receipts')
    expect(storageRemove).toHaveBeenCalledWith(['admin-1/some-uuid.pdf'])
    expect(callOrder).toEqual(['metadata-delete', 'storage-remove'])
  })

  it('never attempts the storage removal when the metadata delete fails', async () => {
    deleteFn.mockReturnValueOnce({ data: null, error: { message: 'delete boom' } })

    await expect(supabaseFileRepository.remove(FILE_METADATA)).rejects.toBeInstanceOf(FileRepositoryError)

    expect(storageRemove).not.toHaveBeenCalled()
  })

  it('surfaces the storage removal failure via FileRepositoryError even though the metadata row was already deleted', async () => {
    // Deliberate design choice (see the repository implementation's own doc
    // comment): a remote error is never absorbed into a silent local
    // success in this app, so the caller is told the cleanup was not fully
    // clean, even though the metadata row is already gone and the delete
    // has effectively "succeeded" from the user's perspective.
    deleteFn.mockReturnValueOnce({ data: null, error: null })
    storageRemove.mockResolvedValueOnce({ data: null, error: { message: 'storage remove boom' } })

    await expect(supabaseFileRepository.remove(FILE_METADATA)).rejects.toBeInstanceOf(FileRepositoryError)
  })
})
