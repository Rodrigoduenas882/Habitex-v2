/** rental_subjects.subject_type, confirmed against the deployed schema. */
export type RentalSubjectType = 'FULL_PROPERTY' | 'ROOM' | 'PARKING'

/**
 * A rental_subjects row - the real backend authority for "what can be
 * rented" in an administration. Never derived/guessed from a
 * property/room/parking id: rental_subjects has its own id and its own
 * nullable FKs (property_id/room_id/parking_id, exactly one populated per
 * subjectType, confirmed against the deployed schema).
 *
 * `propertyId`/`roomId`/`parkingId` are those same raw FKs, exposed
 * verbatim (already selected by the repository for the label-resolution
 * join below, just not previously mapped onto this domain type) - needed to
 * cross-reference a subject back to the property/room it belongs to (e.g.
 * Dashboard occupancy matching a FULL_PROPERTY subject to its Property by
 * propertyId, or a ROOM subject to its Room by roomId).
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
  propertyId: string | null
  roomId: string | null
  parkingId: string | null
  label: string
}

/**
 * A minimal rental_relationship_subjects row - only the FK columns Dashboard
 * occupancy and rental identity resolution need (which relationship a given
 * rental_subject is linked to, and in what role). Deliberately does not
 * carry id/administrationId/createdAt - nothing here needs them.
 *
 * `subjectRole` DOES matter here (unlike the other omitted columns):
 * resolving a rental's *display* identity (DS-002) needs to pick the
 * `PRIMARY` subject specifically, never an `INCLUDED` one - `INCLUDED`
 * exists for a different, not-yet-built feature (parking sublease
 * authorizations), and mistaking it for the rental's primary subject would
 * show the wrong property/room/parking as "what this rental is for".
 */
export interface RentalRelationshipSubjectLink {
  rentalRelationshipId: string
  rentalSubjectId: string
  subjectRole: 'PRIMARY' | 'INCLUDED'
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
 *
 * listRelationshipLinksByAdministration is the first-ever frontend read of
 * public.rental_relationship_subjects (INC-016 research gate, same framing
 * as INC-014's first read of a previously-untouched table) - confirmed via
 * the Supabase MCP (read-only) against the deployed schema before this
 * method was written, not assumed. It is read-only and this port
 * deliberately adds no write path for this table (report_payment-style
 * writes to rental_relationship_subjects are out of scope for INC-016 -
 * Dashboard only ever reads). RLS (can_view_relationship(rental_relationship_id))
 * remains the actual security authority regardless of the administration_id
 * filter expressed here.
 */
export interface RentalSubjectRepository {
  listByAdministration(administrationId: string, subjectType: RentalSubjectType): Promise<RentalSubject[]>
  listRelationshipLinksByAdministration(administrationId: string): Promise<RentalRelationshipSubjectLink[]>
}
