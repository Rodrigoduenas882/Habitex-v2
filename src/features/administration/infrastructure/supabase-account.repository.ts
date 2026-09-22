import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  AdministrationContextError,
  type Account,
  type AccountRepository,
  type AccountStatus,
} from '../domain/administration.types'

interface AccountRow {
  id: string
  person_id: string
  status: AccountStatus
}

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    personId: row.person_id,
    status: row.status,
  }
}

export const supabaseAccountRepository: AccountRepository = {
  async getCurrentAccount() {
    // RLS (accounts: auth_user_id = auth.uid()) already scopes this to the
    // signed-in user - no filter is added here on purpose.
    const { data, error } = await supabaseClient
      .from('accounts')
      .select('id, person_id, status')
      .maybeSingle()

    if (error) {
      throw new AdministrationContextError('Failed to resolve the current account', error)
    }

    return data ? toAccount(data) : null
  },
}
