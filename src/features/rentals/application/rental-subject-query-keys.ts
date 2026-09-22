import type { RentalSubjectType } from '../domain/rental-subject.types'

export const rentalSubjectQueryKeys = {
  list: (administrationId: string, subjectType: RentalSubjectType | 'pending') =>
    ['administration', administrationId, 'rental-subjects', subjectType] as const,
}
