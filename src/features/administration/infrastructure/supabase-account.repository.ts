import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  AdministrationContextError,
  type Account,
  type AccountRepository,
  type AccountStatus,
  type BootstrapAccountInput,
  type BootstrapAccountResult,
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

interface BootstrapAccountRow {
  person_id: string
  account_id: string
  administration_id: string | null
  created: boolean
}

function toBootstrapAccountResult(row: BootstrapAccountRow): BootstrapAccountResult {
  return {
    personId: row.person_id,
    accountId: row.account_id,
    administrationId: row.administration_id,
    created: row.created,
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

  async bootstrapAccount(input: BootstrapAccountInput) {
    // Idempotent on the backend (SECURITY DEFINER): provisions
    // Person+Account+Administration+OWNER membership+trial subscription only
    // if the current auth user has none yet; otherwise just returns them.
    const response = await supabaseClient.rpc('bootstrap_account', {
      p_full_name: input.fullName,
      p_administration_name: input.administrationName ?? '',
    })

    if (response.error) {
      throw new AdministrationContextError('Failed to bootstrap the account', response.error)
    }

    return toBootstrapAccountResult(response.data as BootstrapAccountRow)
  },
}
