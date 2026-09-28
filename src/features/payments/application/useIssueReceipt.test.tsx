import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { chargeQueryKeys } from '@/features/charges/application/charge-query-keys'
import { PaymentRepositoryError } from '../domain/payment.types'
import { paymentQueryKeys } from './payment-query-keys'
import { useIssueReceipt } from './useIssueReceipt'

const { issueReceipt } = vi.hoisted(() => ({ issueReceipt: vi.fn() }))

vi.mock('../infrastructure/supabase-payment.repository', () => ({
  supabasePaymentRepository: {
    listByRelationship: vi.fn(),
    reportPayment: vi.fn(),
    confirmPayment: vi.fn(),
    rejectPayment: vi.fn(),
    listAllocationsForPayment: vi.fn(),
    allocatePayment: vi.fn(),
    getReceiptForPayment: vi.fn(),
    issueReceipt,
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

const RECEIPT = {
  id: 'receipt-1',
  administrationId: 'admin-1',
  rentalRelationshipId: 'rel-1',
  paymentId: 'payment-1',
  receiptNumber: 42,
  status: 'ISSUED' as const,
  fileId: null,
  issuedAt: '2026-01-07T10:00:00Z',
  voidedAt: null,
  voidReason: null,
  createdAt: '2026-01-07T10:00:00Z',
}

const INPUT = {
  administrationId: 'admin-1',
  rentalRelationshipId: 'rel-1',
  paymentId: 'payment-1',
}

describe('useIssueReceipt', () => {
  it('calls the repository through the port with only paymentId, exactly once', async () => {
    issueReceipt.mockResolvedValueOnce(RECEIPT)
    const { result } = renderHook(() => useIssueReceipt(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(issueReceipt).toHaveBeenCalledTimes(1)
    expect(issueReceipt).toHaveBeenCalledWith('payment-1')
    expect(result.current.data).toEqual(RECEIPT)
  })

  it('invalidates exactly the receipt key on success, and never any charges/allocations/list key', async () => {
    issueReceipt.mockResolvedValueOnce(RECEIPT)
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useIssueReceipt(), { wrapper: wrapperFor(client) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: paymentQueryKeys.receipt('admin-1', 'payment-1') })
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: paymentQueryKeys.allocations('admin-1', 'payment-1') })
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: paymentQueryKeys.list('admin-1', 'rel-1') })
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: chargeQueryKeys.list('admin-1', 'rel-1') })
  })

  it('surfaces a repository failure as a mutation error without swallowing its typed code', async () => {
    issueReceipt.mockRejectedValueOnce(new PaymentRepositoryError('receipt_already_issued'))
    const { result } = renderHook(() => useIssueReceipt(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as PaymentRepositoryError).code).toBe('receipt_already_issued')
  })
})
