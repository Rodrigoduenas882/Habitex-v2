import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  RentalParticipantRepositoryError,
  type RentalParticipantRepository,
} from '../domain/rental-participant.types'

interface ParticipantRow {
  rental_relationship_id: string
  person_id: string
}

interface PersonRow {
  id: string
  full_name: string
}

export const supabaseRentalParticipantRepository: RentalParticipantRepository = {
  async listActiveTenantNamesByRelationshipIds(rentalRelationshipIds: string[]): Promise<Map<string, string>> {
    // An empty .in() is either wasteful (a real round trip that always
    // returns nothing) or invalid depending on the client - handled
    // explicitly instead of relying on Supabase's own behavior for it (same
    // guard as RentalTermsRepository.listRelationshipIdsWithTerms).
    if (rentalRelationshipIds.length === 0) {
      return new Map()
    }

    const { data: participants, error: participantsError } = await supabaseClient
      .from('rental_participants')
      .select('rental_relationship_id, person_id')
      .in('rental_relationship_id', rentalRelationshipIds)
      .eq('participation_type', 'TENANT')
      .eq('status', 'ACTIVE')

    if (participantsError) {
      throw new RentalParticipantRepositoryError(
        'Failed to list active tenant participants for the given rental relationships',
        participantsError,
      )
    }

    const rows = participants as ParticipantRow[]
    if (rows.length === 0) {
      return new Map()
    }

    const personIds = [...new Set(rows.map((row) => row.person_id))]

    const { data: people, error: peopleError } = await supabaseClient
      .from('people')
      .select('id, full_name')
      .in('id', personIds)

    if (peopleError) {
      throw new RentalParticipantRepositoryError('Failed to load the active tenants\' people records', peopleError)
    }

    const fullNameByPersonId = new Map((people as PersonRow[]).map((person) => [person.id, person.full_name]))

    const fullNameByRelationshipId = new Map<string, string>()
    for (const row of rows) {
      const fullName = fullNameByPersonId.get(row.person_id)
      if (fullName != null) {
        fullNameByRelationshipId.set(row.rental_relationship_id, fullName)
      }
    }

    return fullNameByRelationshipId
  },
}
