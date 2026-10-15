import { useQuery } from '@tanstack/react-query'
import { paymentRepository } from '../composition'
import { paymentQueryKeys } from './payment-query-keys'

/**
 * Lists every REPORTED payment of `administrationId` - the Dashboard's
 * attention panel read. Pass `undefined` while the current administration
 * isn't resolved yet - the query stays disabled and never fetches until a
 * real id is available (same pattern as usePayments).
 */
export function useReportedPayments(administrationId: string | undefined) {
  return useQuery({
    queryKey: paymentQueryKeys.reportedByAdministration(administrationId ?? 'pending'),
    queryFn: () => {
      if (!administrationId) {
        throw new Error('useReportedPayments: called without a resolved administrationId')
      }
      return paymentRepository.listReportedByAdministration(administrationId)
    },
    enabled: administrationId != null,
  })
}
