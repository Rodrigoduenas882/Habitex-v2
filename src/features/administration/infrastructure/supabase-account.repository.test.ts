import { describe, expect, it, vi } from 'vitest'
import { AdministrationContextError } from '../domain/administration.types'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: { rpc },
}))

import { supabaseAccountRepository } from './supabase-account.repository'

const INPUT = { fullName: 'Jane Doe', administrationName: 'Edificio Central' }

describe('supabaseAccountRepository.bootstrapAccount', () => {
  it('calls bootstrap_account with p_-prefixed args mapped from the input', async () => {
    rpc.mockResolvedValueOnce({
      data: { person_id: 'person-1', account_id: 'account-1', administration_id: 'admin-1', created: true },
      error: null,
    })

    await supabaseAccountRepository.bootstrapAccount(INPUT)

    expect(rpc).toHaveBeenCalledWith('bootstrap_account', {
      p_full_name: 'Jane Doe',
      p_administration_name: 'Edificio Central',
    })
  })

  it('defaults p_administration_name to an empty string when omitted', async () => {
    rpc.mockResolvedValueOnce({
      data: { person_id: 'person-1', account_id: 'account-1', administration_id: null, created: true },
      error: null,
    })

    await supabaseAccountRepository.bootstrapAccount({ fullName: 'Jane Doe' })

    expect(rpc).toHaveBeenCalledWith('bootstrap_account', {
      p_full_name: 'Jane Doe',
      p_administration_name: '',
    })
  })

  it('maps the returned jsonb payload to the domain BootstrapAccountResult shape', async () => {
    rpc.mockResolvedValueOnce({
      data: { person_id: 'person-1', account_id: 'account-1', administration_id: 'admin-1', created: false },
      error: null,
    })

    const result = await supabaseAccountRepository.bootstrapAccount(INPUT)

    expect(result).toEqual({
      personId: 'person-1',
      accountId: 'account-1',
      administrationId: 'admin-1',
      created: false,
    })
  })

  it('maps a null administration_id (no active membership yet) through as null', async () => {
    rpc.mockResolvedValueOnce({
      data: { person_id: 'person-1', account_id: 'account-1', administration_id: null, created: false },
      error: null,
    })

    const result = await supabaseAccountRepository.bootstrapAccount(INPUT)

    expect(result.administrationId).toBeNull()
  })

  it('wraps a Supabase RPC failure in AdministrationContextError', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(supabaseAccountRepository.bootstrapAccount(INPUT)).rejects.toBeInstanceOf(
      AdministrationContextError,
    )
  })
})
