import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  AdministrationContextError,
  type AccessibleAdministration,
  type AdministrationRepository,
  type AdministrationStatus,
} from '../domain/administration.types'

interface AdministrationRow {
  id: string
  name: string
  status: AdministrationStatus
}

interface AdministrationMembershipRow {
  administration: AdministrationRow | AdministrationRow[] | null
}

function toAccessibleAdministration(row: AdministrationRow): AccessibleAdministration {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
  }
}

export const supabaseAdministrationRepository: AdministrationRepository = {
  async listAccessibleAdministrations() {
    // RLS on both administration_members (is_administration_member) and the
    // embedded administrations (is_administration_member) already scopes
    // this to the current person's memberships - no id filter is added here
    // on purpose. member_status/administration_status are confirmed enums,
    // but this deliberately does not filter by them yet - see
    // useCurrentAdministration's own doc comment for why.
    const { data, error } = await supabaseClient
      .from('administration_members')
      .select('administration:administrations(id, name, status)')

    if (error) {
      throw new AdministrationContextError('Failed to list accessible administrations', error)
    }

    return (data as AdministrationMembershipRow[])
      .map((row) => (Array.isArray(row.administration) ? row.administration[0] : row.administration))
      .filter((administration): administration is AdministrationRow => administration != null)
      .map(toAccessibleAdministration)
  },
}
