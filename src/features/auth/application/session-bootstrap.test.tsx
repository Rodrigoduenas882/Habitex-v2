import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import type { AuthSession, AuthStateListener } from '../domain/session.types'
import { AuthSessionListener } from './AuthSessionListener'
import { useAuthSession } from './useAuthSession'

const { getSession, onAuthStateChange } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}))

vi.mock('../infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession,
    signInWithPassword: vi.fn(),
    onAuthStateChange,
    signOut: vi.fn(),
  },
}))

function Probe() {
  const { data, isLoading } = useAuthSession()
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="data">{data ? data.userId : 'null'}</span>
    </div>
  )
}

/**
 * Regression test for a real bug found during manual testing against
 * Supabase: refreshing the browser while authenticated left the app stuck
 * on the loading state forever.
 *
 * Root cause: on bootstrap, Supabase's onAuthStateChange fires an
 * INITIAL_SESSION event that races with useAuthSession's own in-flight
 * getSession() call. When that event arrived first, AuthSessionListener
 * read the query cache for "the previous session" - which was still empty
 * because the session query hadn't resolved yet - concluded the identity
 * had "changed" from unknown to the restored user, and called
 * queryClient.clear(). That destroys the Query instance the mounted
 * useAuthSession() observer is subscribed to; the setQueryData() call right
 * after recreates the cache entry but never reconnects that orphaned
 * observer, so the component never leaves isLoading=true.
 */
describe('session bootstrap race (AuthSessionListener + useAuthSession)', () => {
  it('settles with the restored session when onAuthStateChange fires before getSession resolves', async () => {
    const session: AuthSession = { userId: 'user-A', email: 'a@habitex.app', expiresAtUnix: null }

    let resolveGetSession: (value: AuthSession) => void = () => {}
    getSession.mockReturnValueOnce(
      new Promise<AuthSession>((resolve) => {
        resolveGetSession = resolve
      }),
    )

    let emit: AuthStateListener = () => {}
    onAuthStateChange.mockImplementation((listener: AuthStateListener) => {
      emit = listener
      return () => {}
    })

    const client = createTestQueryClient()
    render(
      <QueryClientProvider client={client}>
        <AuthSessionListener />
        <Probe />
      </QueryClientProvider>,
    )

    // Supabase's INITIAL_SESSION arrives first (the exact race on a real
    // browser refresh while authenticated), before our own getSession()
    // call - started by useAuthSession's queryFn - has resolved.
    emit(session)
    resolveGetSession(session)

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('data').textContent).toBe('user-A')
  })

  it('settles with the restored session when getSession resolves before onAuthStateChange fires', async () => {
    const session: AuthSession = { userId: 'user-A', email: 'a@habitex.app', expiresAtUnix: null }
    getSession.mockResolvedValueOnce(session)

    let emit: AuthStateListener = () => {}
    onAuthStateChange.mockImplementation((listener: AuthStateListener) => {
      emit = listener
      return () => {}
    })

    const client = createTestQueryClient()
    render(
      <QueryClientProvider client={client}>
        <AuthSessionListener />
        <Probe />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('data').textContent).toBe('user-A')

    // The subsequent INITIAL_SESSION event for the same identity must not
    // wipe the session that already resolved.
    emit(session)
    expect(screen.getByTestId('data').textContent).toBe('user-A')
  })
})
