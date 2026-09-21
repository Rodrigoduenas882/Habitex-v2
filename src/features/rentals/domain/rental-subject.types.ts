/** rental_subjects.subject_type, confirmed against the deployed schema. */
export type RentalSubjectType = 'FULL_PROPERTY' | 'ROOM' | 'PARKING'

/**
 * A rental_subjects row - the real backend authority for "what can be
 * rented" in an administration. Never derived/guessed from a
 * property/room/parking id: rental_subjects has its own id and its own
 * nullable FKs (property_id/room_id/parking_id, exactly one populated per
 * subjectType, confirmed against the deployed schema).
 *
 * `label` is a display string resolved from the real referenced asset
 * (properties.name / rooms.name / parkings.identifier) - a legitimate join
 * result, not a fabricated field. If the referenced asset row is somehow
 * missing under a subject whose FK integrity should prevent that, the
 * repository falls back to the subject's own id rather than inventing a
 * name.
 */
export interface RentalSubject {
  id: string
  administrationId: string
  subjectType: RentalSubjectType
  label: string
}

/** Wraps a failed Supabase call so nothing above infrastructure/ ever sees a raw PostgrestError. */
export class RentalSubjectRepositoryError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'RentalSubjectRepositoryError'
    this.cause = cause
  }
}

/**
 * Lists the rental_subjects of one subjectType for one administration - the
 * only read this feature needs to populate "¿Qué vas a arrendar?" with real
 * options. No getById, no create: subjects are created as a side effect of
 * create_full_property_asset/create_room_asset/create_parking_asset, never
 * by this repository directly.
 */
export interface RentalSubjectRepository {
  listByAdministration(administrationId: string, subjectType: RentalSubjectType): Promise<RentalSubject[]>
}
