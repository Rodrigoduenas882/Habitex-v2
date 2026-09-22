import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { AdministrationContextError } from '../domain/administration.types'
import { useAccount } from './useAccount'

const { getCurrentAccount } = vi.hoisted(() => ({ getCurrentAccount: vi.fn() }))

vi.mock('../infrastructure/supabase-account.repository', () => ({
  supabaseAccountRepository: { getCurrentAccount },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useAccount', () => {
  it('resolves the current account through the port, mapped to the domain shape', async () => {
    getCurrentAccount.mockResolvedValueOnce({ id: 'acc-1', personId: 'person-1', status: 'some-status' })

    const { result } = renderHook(() => useAccount(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual({ id: 'acc-1', personId: 'person-1', status: 'some-status' })
  })

  it('resolves to null when no account row exists yet (pre-bootstrap), not as an error', async () => {
    getCurrentAccount.mockResolvedValueOnce(null)

    const { result } = renderHook(() => useAccount(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBeNull()
  })

  it('surfaces a repository failure as a query error, not a swallowed null', async () => {
    getCurrentAccount.mockRejectedValueOnce(
      new AdministrationContextError('Failed to resolve the current account'),
    )

    const { result } = renderHook(() => useAccount(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})
