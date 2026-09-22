import { useQuery } from '@tanstack/react-query'
import { propertyRepository } from '../composition'
import { propertyQueryKeys } from './property-query-keys'

/**
 * Lists the properties of `administrationId`. Pass `undefined` while the
 * current administration isn't resolved yet (loading/error/none/selection-
 * required, see useCurrentAdministration) - the query stays disabled and
 * never fetches until a real id is available.
 */
export function useProperties(administrationId: string | undefined) {
  return useQuery({
    queryKey: propertyQueryKeys.list(administrationId ?? 'pending'),
    queryFn: () => {
      if (!administrationId) {
        throw new Error('useProperties: called without a resolved administrationId')
      }
      return propertyRepository.listByAdministration(administrationId)
    },
    enabled: administrationId != null,
  })
}
