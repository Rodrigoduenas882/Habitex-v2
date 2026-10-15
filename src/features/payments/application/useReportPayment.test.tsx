import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PaymentRepositoryError } from '../domain/payment.types'
import { paymentQueryKeys } from './payment-query-keys'
import { useReportPayment } from './useReportPayment'

const { reportPayment } = vi.hoisted(() => ({ reportPayment: vi.fn() }))

vi.mock('../infrastructure/supabase-payment.repository', () => ({
  supabasePaymentRepository: {
    listByRelationship: vi.fn(),
    reportPayment,
    confirmPayment: vi.fn(),
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

const PAYMENT = {
  id: 'payment-1',
  administrationId: 'admin-1',
  rentalRelationshipId: 'rel-1',
  reportedByPersonId: 'person-1',
  confirmedByPersonId: null,
  status: 'REPORTED' as const,
  amount: 1_000_000,
  currency: 'COP' as const,
  paymentDate: '2026-01-05',
  paymentMethod: null,
  externalReference: null,
  proofFileId: null,
  notes: null,
  reportedAt: '2026-01-05T10:00:00Z',
  confirmedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  createdAt: '2026-01-05T10:00:00Z',
  updatedAt: '2026-01-05T10:00:00Z',
}

describe('useReportPayment', () => {
  it('calls the repository through the port with the full input, exactly once', async () => {
    reportPayment.mockResolvedValueOnce(PAYMENT)
    const { result } = renderHook(() => useReportPayment(), { wrapper: wrapperFor(createClient()) })

    const input = { administrationId: 'admin-1', rentalRelationshipId: 'rel-1', amount: 1_000_000, paymentDate: '2026-01-05' }
    result.current.mutate(input)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(reportPayment).toHaveBeenCalledTimes(1)
    expect(reportPayment).toHaveBeenCalledWith(input)
    expect(result.current.data).toEqual(PAYMENT)
  })

  it("invalidates this relationship's payments list on success", async () => {
    reportPayment.mockResolvedValueOnce(PAYMENT)
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useReportPayment(), { wrapper: wrapperFor(client) })

    result.current.mutate({ administrationId: 'admin-1', rentalRelationshipId: 'rel-1', amount: 1_000_000, paymentDate: '2026-01-05' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: paymentQueryKeys.list('admin-1', 'rel-1') })
  })

  it("surfaces a repository failure as a mutation error without swallowing its typed code", async () => {
    reportPayment.mockRejectedValueOnce(new PaymentRepositoryError('invalid_amount'))
    const { result } = renderHook(() => useReportPayment(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate({ administrationId: 'admin-1', rentalRelationshipId: 'rel-1', amount: -1, paymentDate: '2026-01-05' })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as PaymentRepositoryError).code).toBe('invalid_amount')
  })
})
