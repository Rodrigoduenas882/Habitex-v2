import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PaymentRepositoryError } from '../domain/payment.types'
import { paymentQueryKeys } from './payment-query-keys'
import { useRejectPayment } from './useRejectPayment'

const { rejectPayment } = vi.hoisted(() => ({ rejectPayment: vi.fn() }))

vi.mock('../infrastructure/supabase-payment.repository', () => ({
  supabasePaymentRepository: {
    listByRelationship: vi.fn(),
    reportPayment: vi.fn(),
    confirmPayment: vi.fn(),
    rejectPayment,
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

const PAYMENT_REJECTED = {
  id: 'payment-1',
  administrationId: 'admin-1',
  rentalRelationshipId: 'rel-1',
  reportedByPersonId: 'person-1',
  confirmedByPersonId: null,
  status: 'REJECTED' as const,
  amount: 1_000_000,
  currency: 'COP' as const,
  paymentDate: '2026-01-05',
  paymentMethod: null,
  externalReference: null,
  proofFileId: null,
  notes: null,
  reportedAt: '2026-01-05T10:00:00Z',
  confirmedAt: null,
  rejectedAt: '2026-01-07T10:00:00Z',
  rejectionReason: null,
  createdAt: '2026-01-05T10:00:00Z',
  updatedAt: '2026-01-07T10:00:00Z',
}

describe('useRejectPayment', () => {
  it('calls the repository through the port with only the paymentId, exactly once', async () => {
    rejectPayment.mockResolvedValueOnce(PAYMENT_REJECTED)
    const { result } = renderHook(() => useRejectPayment(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ paymentId: 'payment-1', administrationId: 'admin-1', rentalRelationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(rejectPayment).toHaveBeenCalledTimes(1)
    expect(rejectPayment).toHaveBeenCalledWith('payment-1')
    expect(result.current.data).toEqual(PAYMENT_REJECTED)
  })

  it("invalidates this relationship's payments list on success, using the passed administrationId/rentalRelationshipId", async () => {
    rejectPayment.mockResolvedValueOnce(PAYMENT_REJECTED)
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useRejectPayment(), { wrapper: wrapperFor(client) })

    result.current.mutate({ paymentId: 'payment-1', administrationId: 'admin-1', rentalRelationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: paymentQueryKeys.list('admin-1', 'rel-1') })
  })

  it('surfaces a repository failure as a mutation error without swallowing its typed code', async () => {
    rejectPayment.mockRejectedValueOnce(new PaymentRepositoryError('payment_not_reported'))
    const { result } = renderHook(() => useRejectPayment(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ paymentId: 'payment-1', administrationId: 'admin-1', rentalRelationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as PaymentRepositoryError).code).toBe('payment_not_reported')
  })
})
