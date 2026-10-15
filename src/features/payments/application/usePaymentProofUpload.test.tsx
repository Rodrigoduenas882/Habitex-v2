import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { FileRepositoryError } from '@/features/documents/domain/file.types'
import { usePaymentProofUpload } from './usePaymentProofUpload'

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }))

vi.mock('@/features/documents/infrastructure/supabase-file.repository', () => ({
  supabaseFileRepository: {
    getById: vi.fn(),
    upload,
    download: vi.fn(),
    remove: vi.fn(),
  },
}))

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

const FILE_METADATA = {
  id: 'file-1',
  administrationId: 'admin-1',
  rentalRelationshipId: 'rel-1',
  purpose: 'PAYMENT_PROOF' as const,
  storageBucket: 'documents' as const,
  storagePath: 'admin-1/rel-1/payment-proof/uuid.pdf',
  originalName: 'comprobante.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1234,
  sha256: null,
  uploadedByPersonId: 'person-1',
  createdAt: '2026-01-05T10:00:00Z',
}

describe('usePaymentProofUpload', () => {
  it("calls fileRepository.upload with purpose 'PAYMENT_PROOF' and bucket 'documents', exactly once", async () => {
    upload.mockResolvedValueOnce(FILE_METADATA)
    const blob = new Blob(['x'])
    const { result } = renderHook(() => usePaymentProofUpload(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ administrationId: 'admin-1', rentalRelationshipId: 'rel-1', blob, originalName: 'comprobante.pdf' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(upload).toHaveBeenCalledTimes(1)
    expect(upload).toHaveBeenCalledWith({
      administrationId: 'admin-1',
      rentalRelationshipId: 'rel-1',
      purpose: 'PAYMENT_PROOF',
      bucket: 'documents',
      blob,
      originalName: 'comprobante.pdf',
    })
    expect(result.current.data).toEqual(FILE_METADATA)
  })

  it('surfaces a repository failure as a mutation error without swallowing it', async () => {
    upload.mockRejectedValueOnce(new FileRepositoryError('upload failed'))
    const { result } = renderHook(() => usePaymentProofUpload(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ administrationId: 'admin-1', rentalRelationshipId: 'rel-1', blob: new Blob(['x']), originalName: null })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toBeInstanceOf(FileRepositoryError)
  })
})
