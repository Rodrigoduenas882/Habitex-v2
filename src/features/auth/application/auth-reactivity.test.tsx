import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from '@/features/auth/presentation/ProtectedRoute'
import { RedirectIfAuthenticated } from '@/features/auth/presentation/RedirectIfAuthenticated'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import type { AuthSession, AuthStateListener } from '../domain/session.types'
import { AuthSessionListener } from './AuthSessionListener'
import { useLogin } from './useLogin'
import { useLogout } from './useLogout'

const { getSession, signInWithPassword, signOut, onAuthStateChange } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
}))

vi.mock('../infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession,
    signInWithPassword,
    onAuthStateChange,
    signOut,
  },
}))

function LoginTrigger() {
  const login = useLogin()
  return (
    <div>
      <p>Login page</p>
      <button
        type="button"
        onClick={() => {
          login.mutate({ email: 'a@habitex.app', password: 'secret' })
        }}
      >
        do-login
      </button>
    </div>
  )
}

function ProtectedHome() {
  const logout = useLogout()

  return (
    <div>
      <p>Protected home</p>
      <button
        type="button"
        onClick={() => {
          logout.mutate()
        }}
      >
        do-logout
      </button>
    </div>
  )
}

function renderApp(initialPath: string, client = createTestQueryClient()) {
  render(
    <QueryClientProvider client={client}>
      <AuthSessionListener />
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<ProtectedHome />} />
          </Route>
          <Route element={<RedirectIfAuthenticated />}>
            <Route path="/login" element={<LoginTrigger />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

/** Captures the callback AuthSessionListener registers, to fire it manually. */
function captureAuthStateListener() {
  let emit: AuthStateListener = () => {}
  onAuthStateChange.mockImplementation((listener: AuthStateListener) => {
    emit = listener
    return () => {}
  })
  return (session: AuthSession) => {
    emit(session)
  }
}

/**
 * Regression tests for a real bug found during manual testing against
 * Supabase: after a successful login or logout, the app stayed on the same
 * screen until the browser was refreshed.
 *
 * Root cause: AuthSessionListener called queryClient.clear() on every real
 * identity change (unauthenticated -> user on login, user -> null on
 * logout) - not just on the page-load race from the previous bug. clear()
 * destroys the Query instance the mounted useAuthSession() observer is
 * subscribed to, orphaning it; the mutation's own setQueryData() and the
 * listener's post-clear setQueryData() both write to a cache entry the
 * orphaned observer never reconnects to, so the UI never re-renders until a
 * full remount (F5) creates a fresh observer.
 *
 * These tests exercise the real mutation + QueryClient + listener + route
 * guards together (only the Supabase repository is mocked), the same way
 * the bug actually manifested - isolated unit tests of each piece already
 * existed and did not catch it.
 */
describe('auth reactivity: login/logout without a page refresh', () => {
  it('reflects a successful login immediately, with no refresh', async () => {
    const user = userEvent.setup()
    const emit = captureAuthStateListener()
    getSession.mockResolvedValueOnce(null)

    renderApp('/login')
    await screen.findByText('Login page')
    emit(null) // INITIAL_SESSION on an unauthenticated bootstrap

    const session: AuthSession = { userId: 'user-A', email: 'a@habitex.app', expiresAtUnix: null }
    signInWithPassword.mockResolvedValueOnce(session)

    await user.click(screen.getByRole('button', { name: 'do-login' }))

    expect(await screen.findByText('Protected home')).toBeInTheDocument()

    // The real SIGNED_IN event Supabase fires shortly after must not undo it.
    emit(session)
    expect(screen.getByText('Protected home')).toBeInTheDocument()
  })

  it('reflects a successful logout immediately, with no refresh', async () => {
    const user = userEvent.setup()
    const emit = captureAuthStateListener()
    const session: AuthSession = { userId: 'user-A', email: 'a@habitex.app', expiresAtUnix: null }
    getSession.mockResolvedValueOnce(session)

    renderApp('/')
    await screen.findByText('Protected home')
    emit(session) // INITIAL_SESSION, same identity as the resolved session

    signOut.mockResolvedValueOnce(undefined)
    await user.click(screen.getByRole('button', { name: 'do-logout' }))

    expect(await screen.findByText('Login page')).toBeInTheDocument()

    // The real SIGNED_OUT event Supabase fires shortly after must not revert it.
    emit(null)
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('settles into the app (not stuck loading) on a fresh bootstrap with a persisted session', async () => {
    const emit = captureAuthStateListener()
    const session: AuthSession = { userId: 'user-A', email: 'a@habitex.app', expiresAtUnix: null }
    let resolveGetSession: (value: AuthSession) => void = () => {}
    getSession.mockReturnValueOnce(
      new Promise<AuthSession>((resolve) => {
        resolveGetSession = resolve
      }),
    )

    renderApp('/')

    // The exact race from the first bootstrap bug: INITIAL_SESSION fires
    // before our own getSession() call resolves.
    emit(session)
    resolveGetSession(session)

    expect(await screen.findByText('Protected home')).toBeInTheDocument()
  })

  it('does not leak cached business data from user A into user B after logout', async () => {
    const user = userEvent.setup()
    const emit = captureAuthStateListener()
    const sessionA: AuthSession = { userId: 'user-A', email: 'a@habitex.app', expiresAtUnix: null }
    getSession.mockResolvedValueOnce(sessionA)

    const client = renderApp('/')
    await screen.findByText('Protected home')
    emit(sessionA)

    client.setQueryData(['administration', 'A-admin', 'rentals'], ['rental-of-A'])
    expect(client.getQueryData(['administration', 'A-admin', 'rentals'])).toEqual(['rental-of-A'])

    signOut.mockResolvedValueOnce(undefined)
    await user.click(screen.getByRole('button', { name: 'do-logout' }))
    await screen.findByText('Login page')
    emit(null)

    expect(client.getQueryData(['administration', 'A-admin', 'rentals'])).toBeUndefined()

    const sessionB: AuthSession = { userId: 'user-B', email: 'b@habitex.app', expiresAtUnix: null }
    signInWithPassword.mockResolvedValueOnce(sessionB)
    await user.click(screen.getByRole('button', { name: 'do-login' }))
    await screen.findByText('Protected home')
    emit(sessionB)

    expect(client.getQueryData(['administration', 'A-admin', 'rentals'])).toBeUndefined()
  })
})
