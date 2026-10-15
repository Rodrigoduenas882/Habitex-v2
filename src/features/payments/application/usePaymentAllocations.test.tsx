import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PaymentRepositoryError } from '../domain/payment.types'
import { usePaymentAllocations } from './usePaymentAllocations'

const { listAllocationsForPayment } = vi.hoisted(() => ({ listAllocationsForPayment: vi.fn() }))

vi.mock('../infrastructure/supabase-payment.repository', () => ({
  supabasePaymentRepository: {
    listByRelationship: vi.fn(),
    reportPayment: vi.fn(),
    confirmPayment: vi.fn(),
    rejectPayment: vi.fn(),
    listAllocationsForPayment,
    allocatePayment: vi.fn(),
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

const ALLOCATION = {
  id: 'allocation-1',
  administrationId: 'admin-1',
  paymentId: 'payment-1',
  chargeId: 'charge-1',
  amount: 500_000,
  createdAt: '2026-01-06T10:00:00Z',
}

describe('usePaymentAllocations', () => {
  it('stays disabled until both administrationId and paymentId are resolved', () => {
    const { result } = renderHook(() => usePaymentAllocations(undefined, undefined), { wrapper: wrapperFor(createClient()) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(listAllocationsForPayment).not.toHaveBeenCalled()
  })

  it('calls the repository through the port with the resolved paymentId once both ids are real', async () => {
    listAllocationsForPayment.mockResolvedValueOnce([ALLOCATION])
    const { result } = renderHook(() => usePaymentAllocations('admin-1', 'payment-1'), { wrapper: wrapperFor(createClient()) })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(listAllocationsForPayment).toHaveBeenCalledWith('payment-1')
    expect(result.current.data).toEqual([ALLOCATION])
  })

  it('surfaces a repository failure as a query error without swallowing its typed code', async () => {
    listAllocationsForPayment.mockRejectedValueOnce(new PaymentRepositoryError('forbidden'))
    const { result } = renderHook(() => usePaymentAllocations('admin-1', 'payment-1'), { wrapper: wrapperFor(createClient()) })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as PaymentRepositoryError).code).toBe('forbidden')
  })
})
