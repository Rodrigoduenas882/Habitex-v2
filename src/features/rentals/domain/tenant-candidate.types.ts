/**
 * A Person already linked to an administration via
 * person_administration_links - a candidate for the "existing tenant" path
 * of create_rental_draft. Deliberately not filtered by relationship_type
 * (TENANT vs CONTACT): create_rental_draft's own "existing tenant"
 * validation only checks administration_id + person_id, not
 * relationship_type, so narrowing this list further would invent a
 * restriction the backend itself does not enforce.
 */
export interface TenantCandidate {
  id: string
  fullName: string
}

/** Wraps a failed Supabase call so nothing above infrastructure/ ever sees a raw PostgrestError. */
export class TenantCandidateRepositoryError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'TenantCandidateRepositoryError'
    this.cause = cause
  }
}

/**
 * Lists the people already linked to an administration - used only to
 * populate the "persona existente" tenant option. Not a general people/
 * contacts module (explicitly out of scope for this increment) - this is
 * scoped to exactly what create_rental_draft's existing-tenant path needs.
 */
export interface TenantCandidateRepository {
  listByAdministration(administrationId: string): Promise<TenantCandidate[]>
}
