import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  RentalTermsRepositoryError,
  type AdministrationFeeMode,
  type CreateRentalTermVersionInput,
  type RentalTermVersion,
  type RentalTermsRepository,
  type UtilitiesResponsibility,
} from '../domain/rental-terms.types'

interface RentalTermVersionRow {
  id: string
  rental_relationship_id: string
  version_number: number
  effective_from: string
  effective_until: string | null
  rent_amount: number
  administration_mode: AdministrationFeeMode
  utilities_mode: UtilitiesResponsibility | null
  created_at: string
}

const RENTAL_TERM_VERSION_COLUMNS =
  'id, rental_relationship_id, version_number, effective_from, effective_until, rent_amount, administration_mode, utilities_mode, created_at'

function toRentalTermVersion(row: RentalTermVersionRow): RentalTermVersion {
  return {
    id: row.id,
    rentalRelationshipId: row.rental_relationship_id,
    versionNumber: row.version_number,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    rentAmount: row.rent_amount,
    administrationMode: row.administration_mode,
    utilitiesMode: row.utilities_mode,
    createdAt: row.created_at,
  }
}

export const supabaseRentalTermsRepository: RentalTermsRepository = {
  async create(input: CreateRentalTermVersionInput): Promise<RentalTermVersion> {
    // version_number is always 1 and effective_until is always null - this
    // repository only ever creates the first version of a relationship (see
    // CreateRentalTermVersionInput's own doc comment). RLS
    // (rental_terms_insert) rejects this outright unless the parent
    // rental_relationship is still DRAFT and the caller can manage its
    // administration.
    const { data, error } = await supabaseClient
      .from('rental_term_versions')
      .insert({
        rental_relationship_id: input.rentalRelationshipId,
        version_number: 1,
        effective_from: input.effectiveFrom,
        effective_until: null,
        rent_amount: input.rentAmount,
        administration_mode: input.administrationMode,
        utilities_mode: input.utilitiesMode,
      })
      .select(RENTAL_TERM_VERSION_COLUMNS)
      .single()

    if (error) {
      throw new RentalTermsRepositoryError('Failed to create the rental term version', error)
    }

    return toRentalTermVersion(data)
  },

  async getCurrent(rentalRelationshipId: string): Promise<RentalTermVersion | null> {
    // Ordered by version_number descending, limit 1 - this increment never
    // creates more than one version, so this is simply "the one version if
    // it exists yet" (see RentalTermsRepository's own doc comment).
    const { data, error } = await supabaseClient
      .from('rental_term_versions')
      .select(RENTAL_TERM_VERSION_COLUMNS)
      .eq('rental_relationship_id', rentalRelationshipId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new RentalTermsRepositoryError('Failed to load the current rental term version', error)
    }

    return data ? toRentalTermVersion(data) : null
  },
}
