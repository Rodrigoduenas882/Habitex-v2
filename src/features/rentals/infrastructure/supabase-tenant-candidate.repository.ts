import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  TenantCandidateRepositoryError,
  type TenantCandidate,
  type TenantCandidateRepository,
} from '../domain/tenant-candidate.types'

interface LinkRow {
  person_id: string
}

interface PersonRow {
  id: string
  full_name: string
}

export const supabaseTenantCandidateRepository: TenantCandidateRepository = {
  async listByAdministration(administrationId) {
    const { data: links, error: linksError } = await supabaseClient
      .from('person_administration_links')
      .select('person_id')
      .eq('administration_id', administrationId)

    if (linksError) {
      throw new TenantCandidateRepositoryError('Failed to list people linked to the administration', linksError)
    }

    const personIds = (links as LinkRow[]).map((link) => link.person_id)
    if (personIds.length === 0) {
      return []
    }

    const { data: people, error: peopleError } = await supabaseClient
      .from('people')
      .select('id, full_name')
      .in('id', personIds)

    if (peopleError) {
      throw new TenantCandidateRepositoryError('Failed to load people linked to the administration', peopleError)
    }

    return (people as PersonRow[]).map(
      (person): TenantCandidate => ({ id: person.id, fullName: person.full_name }),
    )
  },
}
