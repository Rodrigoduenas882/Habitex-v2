import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { PaymentRepositoryError } from '../domain/payment.types'
import { paymentQueryKeys } from './payment-query-keys'
import { useReportedPayments } from './useReportedPayments'

const { listReportedByAdministration } = vi.hoisted(() => ({ listReportedByAdministration: vi.fn() }))

vi.mock('../infrastructure/supabase-payment.repository', () => ({
  supabasePaymentRepository: { listReportedByAdministration },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useReportedPayments', () => {
  it('does not fetch while no administrationId is available', () => {
    const { result } = renderHook(() => useReportedPayments(undefined), { wrapper })

    expect(listReportedByAdministration).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches through the port, scoped under ["administration", administrationId, "payments", "reported"], once an administrationId is available', async () => {
    listReportedByAdministration.mockResolvedValueOnce([{ id: 'payment-1', status: 'REPORTED' }])

    const { result } = renderHook(() => useReportedPayments('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(listReportedByAdministration).toHaveBeenCalledWith('admin-1')
    expect(result.current.data).toHaveLength(1)
  })

  it('uses the ["administration", administrationId, "payments", "reported"] key shape', () => {
    expect(paymentQueryKeys.reportedByAdministration('admin-1')).toEqual(['administration', 'admin-1', 'payments', 'reported'])
  })

  it('surfaces a repository failure as a query error', async () => {
    listReportedByAdministration.mockRejectedValueOnce(new PaymentRepositoryError('unknown'))

    const { result } = renderHook(() => useReportedPayments('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})
