import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PaymentRepositoryError } from '../domain/payment.types'
import { usePayments } from './usePayments'

const { listByRelationship } = vi.hoisted(() => ({ listByRelationship: vi.fn() }))

vi.mock('../infrastructure/supabase-payment.repository', () => ({
  supabasePaymentRepository: {
    listByRelationship,
    reportPayment: vi.fn(),
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
  paymentMethod: 'BANK_TRANSFER' as const,
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

describe('usePayments', () => {
  it('stays disabled until both administrationId and rentalRelationshipId are resolved', () => {
    const { result } = renderHook(() => usePayments(undefined, undefined), { wrapper: wrapperFor(createClient()) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(listByRelationship).not.toHaveBeenCalled()
  })

  it('calls the repository through the port with the resolved rentalRelationshipId once both ids are real', async () => {
    listByRelationship.mockResolvedValueOnce([PAYMENT])
    const { result } = renderHook(() => usePayments('admin-1', 'rel-1'), { wrapper: wrapperFor(createClient()) })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(listByRelationship).toHaveBeenCalledWith('rel-1')
    expect(result.current.data).toEqual([PAYMENT])
  })

  it('surfaces a repository failure as a query error without swallowing its typed code', async () => {
    listByRelationship.mockRejectedValueOnce(new PaymentRepositoryError('forbidden'))
    const { result } = renderHook(() => usePayments('admin-1', 'rel-1'), { wrapper: wrapperFor(createClient()) })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as PaymentRepositoryError).code).toBe('forbidden')
  })
})
