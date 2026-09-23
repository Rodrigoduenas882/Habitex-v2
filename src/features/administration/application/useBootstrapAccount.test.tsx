import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AdministrationContextError } from '../domain/administration.types'
import { administrationQueryKeys } from './administration-query-keys'
import { useBootstrapAccount } from './useBootstrapAccount'

const { getCurrentAccount, bootstrapAccount } = vi.hoisted(() => ({
  getCurrentAccount: vi.fn(),
  bootstrapAccount: vi.fn(),
}))

vi.mock('../infrastructure/supabase-account.repository', () => ({
  supabaseAccountRepository: { getCurrentAccount, bootstrapAccount },
}))

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

const INPUT = { fullName: 'Jane Doe', administrationName: 'Edificio Central' }

const RESULT = {
  personId: 'person-1',
  accountId: 'account-1',
  administrationId: 'admin-1',
  created: true,
}

describe('useBootstrapAccount', () => {
  it('calls the repository through the port with the given input', async () => {
    bootstrapAccount.mockResolvedValueOnce(RESULT)
    const client = createClient()
    const { result } = renderHook(() => useBootstrapAccount(), { wrapper: wrapperFor(client) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(bootstrapAccount).toHaveBeenCalledWith(INPUT)
    expect(result.current.data).toEqual(RESULT)
  })

  it('invalidates both the account and accessible-administrations queries on success', async () => {
    bootstrapAccount.mockResolvedValueOnce(RESULT)
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useBootstrapAccount(), { wrapper: wrapperFor(client) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: administrationQueryKeys.account })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: administrationQueryKeys.accessibleAdministrations })
  })

  it('surfaces a repository failure as a mutation error', async () => {
    bootstrapAccount.mockRejectedValueOnce(new AdministrationContextError('Failed to bootstrap the account'))
    const client = createClient()
    const { result } = renderHook(() => useBootstrapAccount(), { wrapper: wrapperFor(client) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toBeInstanceOf(AdministrationContextError)
  })
})
