import { useQuery } from '@tanstack/react-query'
import { rentalSubjectRepository } from '../composition'
import { rentalQueryKeys } from './rental-query-keys'

/**
 * Lists every rental_relationship_subjects link of `administrationId` - the
 * read Dashboard occupancy needs to know which rental_subjects are actually
 * tied to a rental relationship. Pass `undefined` while the current
 * administration isn't resolved yet - the query stays disabled and never
 * fetches until a real id is available (same pattern as useRentals).
 */
export function useRentalSubjectLinks(administrationId: string | undefined) {
  return useQuery({
    queryKey: rentalQueryKeys.subjectLinks(administrationId ?? 'pending'),
    queryFn: () => {
      if (!administrationId) {
        throw new Error('useRentalSubjectLinks: called without a resolved administrationId')
      }
      return rentalSubjectRepository.listRelationshipLinksByAdministration(administrationId)
    },
    enabled: administrationId != null,
  })
}
