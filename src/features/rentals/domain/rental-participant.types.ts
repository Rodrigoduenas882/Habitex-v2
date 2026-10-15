/** Wraps a failed Supabase call so nothing above infrastructure/ ever sees a raw PostgrestError. */
export class RentalParticipantRepositoryError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'RentalParticipantRepositoryError'
    this.cause = cause
  }
}

/**
 * Resolves the current (participation_type='TENANT', status='ACTIVE')
 * tenant's full name for each of the given rental relationships, in one
 * batched pair of queries (never one query per relationship - see this
 * method's own implementation note). A relationship with no matching row
 * (should not happen for any relationship created via create_rental_draft,
 * but not assumed) is simply absent from the returned Map - callers treat
 * a missing key the same as "no tenant resolved yet", never an error.
 */
export interface RentalParticipantRepository {
  listActiveTenantNamesByRelationshipIds(rentalRelationshipIds: string[]): Promise<Map<string, string>>
}
