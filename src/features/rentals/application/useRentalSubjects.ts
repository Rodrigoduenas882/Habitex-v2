import { useQuery } from '@tanstack/react-query'
import type { RentalSubjectType } from '../domain/rental-subject.types'
import { rentalSubjectRepository } from '../composition'
import { rentalSubjectQueryKeys } from './rental-subject-query-keys'

/**
 * Lists the real rental_subjects of `subjectType` for `administrationId`.
 * Disabled until both are resolved - "¿Qué vas a arrendar?" must be
 * answered before this fetches anything real.
 */
export function useRentalSubjects(administrationId: string | undefined, subjectType: RentalSubjectType | undefined) {
  return useQuery({
    queryKey: rentalSubjectQueryKeys.list(administrationId ?? 'pending', subjectType ?? 'pending'),
    queryFn: () => {
      if (!administrationId || !subjectType) {
        throw new Error('useRentalSubjects: called without a resolved administrationId/subjectType')
      }
      return rentalSubjectRepository.listByAdministration(administrationId, subjectType)
    },
    enabled: administrationId != null && subjectType != null,
  })
}
