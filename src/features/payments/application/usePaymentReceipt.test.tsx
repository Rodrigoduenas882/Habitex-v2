import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PaymentRepositoryError } from '../domain/payment.types'
import { usePaymentReceipt } from './usePaymentReceipt'

const { getReceiptForPayment } = vi.hoisted(() => ({ getReceiptForPayment: vi.fn() }))

vi.mock('../infrastructure/supabase-payment.repository', () => ({
  supabasePaymentRepository: {
    listByRelationship: vi.fn(),
    reportPayment: vi.fn(),
    confirmPayment: vi.fn(),
    rejectPayment: vi.fn(),
    listAllocationsForPayment: vi.fn(),
    allocatePayment: vi.fn(),
    getReceiptForPayment,
    issueReceipt: vi.fn(),
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

describe('usePaymentReceipt', () => {
  it('stays disabled until both administrationId and paymentId are resolved', () => {
    const { result } = renderHook(() => usePaymentReceipt(undefined, undefined), { wrapper: wrapperFor(createClient()) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(getReceiptForPayment).not.toHaveBeenCalled()
  })

  it('calls the repository through the port with the resolved paymentId once both ids are real', async () => {
    getReceiptForPayment.mockResolvedValueOnce(RECEIPT)
    const { result } = renderHook(() => usePaymentReceipt('admin-1', 'payment-1'), { wrapper: wrapperFor(createClient()) })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(getReceiptForPayment).toHaveBeenCalledWith('payment-1')
    expect(result.current.data).toEqual(RECEIPT)
  })

  it('resolves to null when no receipt exists yet', async () => {
    getReceiptForPayment.mockResolvedValueOnce(null)
    const { result } = renderHook(() => usePaymentReceipt('admin-1', 'payment-1'), { wrapper: wrapperFor(createClient()) })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBeNull()
  })

  it('surfaces a repository failure as a query error without swallowing its typed code', async () => {
    getReceiptForPayment.mockRejectedValueOnce(new PaymentRepositoryError('forbidden'))
    const { result } = renderHook(() => usePaymentReceipt('admin-1', 'payment-1'), { wrapper: wrapperFor(createClient()) })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as PaymentRepositoryError).code).toBe('forbidden')
  })
})
