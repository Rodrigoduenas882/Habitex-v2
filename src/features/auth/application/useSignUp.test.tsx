import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { SessionAuthError, type AuthSession } from '../domain/session.types'
import { authQueryKeys } from './auth-query-keys'
import { useSignUp } from './useSignUp'

const { signUp } = vi.hoisted(() => ({ signUp: vi.fn() }))

vi.mock('../infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp,
    onAuthStateChange: vi.fn(() => () => {}),
    signOut: vi.fn(),
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useSignUp', () => {
  it('calls the repository signUp through the port with the given credentials', async () => {
    const session: AuthSession = { userId: 'user-1', email: 'new@habitex.app', expiresAtUnix: null }
    signUp.mockResolvedValueOnce(session)
    const { result } = renderHook(() => useSignUp(), { wrapper })

    result.current.mutate({ email: 'new@habitex.app', password: 'secret123' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(signUp).toHaveBeenCalledTimes(1)
    expect(signUp).toHaveBeenCalledWith({ email: 'new@habitex.app', password: 'secret123' })
  })

  it('writes the returned session into the auth session query cache on success', async () => {
    const session: AuthSession = { userId: 'user-1', email: 'new@habitex.app', expiresAtUnix: null }
    signUp.mockResolvedValueOnce(session)
    const client = createTestQueryClient()
    const { result } = renderHook(() => useSignUp(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    })

    result.current.mutate({ email: 'new@habitex.app', password: 'secret123' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData(authQueryKeys.session)).toEqual(session)
  })

  it('surfaces a failed sign-up as a mutation error without swallowing its typed code', async () => {
    signUp.mockRejectedValueOnce(new SessionAuthError('unknown'))
    const { result } = renderHook(() => useSignUp(), { wrapper })

    result.current.mutate({ email: 'existing@habitex.app', password: 'secret123' })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as SessionAuthError).code).toBe('unknown')
  })
})
