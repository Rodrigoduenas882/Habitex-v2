import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { chargeQueryKeys } from '@/features/charges/application/charge-query-keys'
import { PaymentRepositoryError } from '../domain/payment.types'
import { paymentQueryKeys } from './payment-query-keys'
import { useAllocatePayment } from './useAllocatePayment'

const { allocatePayment } = vi.hoisted(() => ({ allocatePayment: vi.fn() }))

vi.mock('../infrastructure/supabase-payment.repository', () => ({
  supabasePaymentRepository: {
    listByRelationship: vi.fn(),
    reportPayment: vi.fn(),
    confirmPayment: vi.fn(),
    rejectPayment: vi.fn(),
    listAllocationsForPayment: vi.fn(),
    allocatePayment,
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

const INPUT = {
  administrationId: 'admin-1',
  rentalRelationshipId: 'rel-1',
  paymentId: 'payment-1',
  chargeId: 'charge-1',
  amount: 500_000,
}

describe('useAllocatePayment', () => {
  it('calls the repository through the port with only paymentId/chargeId/amount, exactly once', async () => {
    allocatePayment.mockResolvedValueOnce(ALLOCATION)
    const { result } = renderHook(() => useAllocatePayment(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(allocatePayment).toHaveBeenCalledTimes(1)
    expect(allocatePayment).toHaveBeenCalledWith({ paymentId: 'payment-1', chargeId: 'charge-1', amount: 500_000 })
    expect(result.current.data).toEqual(ALLOCATION)
  })

  it('invalidates exactly the allocations key and the charges list key on success', async () => {
    allocatePayment.mockResolvedValueOnce(ALLOCATION)
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useAllocatePayment(), { wrapper: wrapperFor(client) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledTimes(2)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: paymentQueryKeys.allocations('admin-1', 'payment-1') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chargeQueryKeys.list('admin-1', 'rel-1') })
  })

  it('surfaces a repository failure as a mutation error without swallowing its typed code', async () => {
    allocatePayment.mockRejectedValueOnce(new PaymentRepositoryError('allocation_exceeds_payment'))
    const { result } = renderHook(() => useAllocatePayment(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as PaymentRepositoryError).code).toBe('allocation_exceeds_payment')
  })
})
