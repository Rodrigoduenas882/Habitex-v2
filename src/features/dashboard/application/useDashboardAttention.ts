import { useMemo } from 'react'
import { useReportedPayments } from '@/features/payments/application/useReportedPayments'
import type { Payment } from '@/features/payments/domain/payment.types'

export interface DashboardAttention {
  status: 'loading' | 'error' | 'ready'
  reportedPayments: Payment[]
}

const LOADING: DashboardAttention = { status: 'loading', reportedPayments: [] }
const ERROR: DashboardAttention = { status: 'error', reportedPayments: [] }

/**
 * A thin pass-through over useReportedPayments, with the same status-
 * propagation discipline as useDashboardOccupancy/useDashboardFinancials -
 * loading/error state is never conflated with a legitimate empty result. The
 * next subtask (presentation) maps `reportedPayments` into AttentionPanel's
 * item shape.
 */
export function useDashboardAttention(administrationId: string | undefined): DashboardAttention {
  const reportedPaymentsQuery = useReportedPayments(administrationId)

  const isError = reportedPaymentsQuery.isError
  const isSuccess = reportedPaymentsQuery.isSuccess
  const reportedPayments = reportedPaymentsQuery.data

  return useMemo(() => {
    if (isError) {
      return ERROR
    }

    if (!isSuccess || !reportedPayments) {
      return LOADING
    }

    return { status: 'ready', reportedPayments }
  }, [isError, isSuccess, reportedPayments])
}
