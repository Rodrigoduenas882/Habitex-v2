import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { useDashboardAttention } from './useDashboardAttention'

const { listReportedByAdministration } = vi.hoisted(() => ({ listReportedByAdministration: vi.fn() }))

vi.mock('@/features/payments/infrastructure/supabase-payment.repository', () => ({
  supabasePaymentRepository: { listReportedByAdministration },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const REPORTED_PAYMENT = {
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

describe('useDashboardAttention', () => {
  it('passes through the reported payments once resolved', async () => {
    listReportedByAdministration.mockResolvedValueOnce([REPORTED_PAYMENT])

    const { result } = renderHook(() => useDashboardAttention('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(result.current.reportedPayments).toEqual([REPORTED_PAYMENT])
  })

  it('reports status "loading" while the underlying query is still pending, never a fabricated empty result', () => {
    listReportedByAdministration.mockReturnValueOnce(new Promise(() => {}))

    const { result } = renderHook(() => useDashboardAttention('admin-1'), { wrapper })

    expect(result.current.status).toBe('loading')
    expect(result.current.reportedPayments).toEqual([])
  })

  it('reports status "error" if the underlying query fails', async () => {
    listReportedByAdministration.mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() => useDashboardAttention('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
  })

  it('a genuinely empty (0-length) reported payments list is still "ready", not conflated with loading', async () => {
    listReportedByAdministration.mockResolvedValueOnce([])

    const { result } = renderHook(() => useDashboardAttention('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(result.current.reportedPayments).toEqual([])
  })
})
