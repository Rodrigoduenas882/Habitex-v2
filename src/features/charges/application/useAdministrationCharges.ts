import { useQuery } from '@tanstack/react-query'
import { chargeRepository } from '../composition'
import { chargeQueryKeys } from './charge-query-keys'

/**
 * Lists every charge of `administrationId` whose due_date falls inside
 * `[range.from, range.toExclusive)`. Pass `undefined` for either argument
 * while it isn't resolved yet - the query stays disabled and never fetches
 * until both are real (same pattern as useCharges).
 */
export function useAdministrationCharges(
  administrationId: string | undefined,
  range: { from: string; toExclusive: string } | undefined,
) {
  return useQuery({
    queryKey: chargeQueryKeys.listByAdministration(administrationId ?? 'pending', range ?? { from: 'pending', toExclusive: 'pending' }),
    queryFn: () => {
      if (!administrationId || !range) {
        throw new Error('useAdministrationCharges: called without a resolved administrationId/range')
      }
      return chargeRepository.listByAdministration(administrationId, range)
    },
    enabled: Boolean(administrationId) && Boolean(range),
  })
}
