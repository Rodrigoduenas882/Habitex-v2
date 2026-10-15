import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PaymentRepositoryError } from '../domain/payment.types'
import { paymentQueryKeys } from './payment-query-keys'
import { useConfirmPayment } from './useConfirmPayment'

const { confirmPayment } = vi.hoisted(() => ({ confirmPayment: vi.fn() }))

vi.mock('../infrastructure/supabase-payment.repository', () => ({
  supabasePaymentRepository: {
    listByRelationship: vi.fn(),
    reportPayment: vi.fn(),
    confirmPayment,
    rejectPayment: vi.fn(),
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

const PAYMENT_CONFIRMED = {
  id: 'payment-1',
  administrationId: 'admin-1',
  rentalRelationshipId: 'rel-1',
  reportedByPersonId: 'person-1',
  confirmedByPersonId: 'person-2',
  status: 'CONFIRMED' as const,
  amount: 1_000_000,
  currency: 'COP' as const,
  paymentDate: '2026-01-05',
  paymentMethod: null,
  externalReference: null,
  proofFileId: null,
  notes: null,
  reportedAt: '2026-01-05T10:00:00Z',
  confirmedAt: '2026-01-06T10:00:00Z',
  rejectedAt: null,
  rejectionReason: null,
  createdAt: '2026-01-05T10:00:00Z',
  updatedAt: '2026-01-06T10:00:00Z',
}

describe('useConfirmPayment', () => {
  it('calls the repository through the port with only the paymentId, exactly once', async () => {
    confirmPayment.mockResolvedValueOnce(PAYMENT_CONFIRMED)
    const { result } = renderHook(() => useConfirmPayment(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ paymentId: 'payment-1', administrationId: 'admin-1', rentalRelationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(confirmPayment).toHaveBeenCalledTimes(1)
    expect(confirmPayment).toHaveBeenCalledWith('payment-1')
    expect(result.current.data).toEqual(PAYMENT_CONFIRMED)
  })

  it("invalidates this relationship's payments list on success, using the passed administrationId/rentalRelationshipId", async () => {
    confirmPayment.mockResolvedValueOnce(PAYMENT_CONFIRMED)
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useConfirmPayment(), { wrapper: wrapperFor(client) })

    result.current.mutate({ paymentId: 'payment-1', administrationId: 'admin-1', rentalRelationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: paymentQueryKeys.list('admin-1', 'rel-1') })
  })

  it('surfaces a repository failure as a mutation error without swallowing its typed code', async () => {
    confirmPayment.mockRejectedValueOnce(new PaymentRepositoryError('payment_not_reported'))
    const { result } = renderHook(() => useConfirmPayment(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ paymentId: 'payment-1', administrationId: 'admin-1', rentalRelationshipId: 'rel-1' })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as PaymentRepositoryError).code).toBe('payment_not_reported')
  })
})
