import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import type { AuthSession, AuthStateListener } from '../domain/session.types'
import { AuthSessionListener } from './AuthSessionListener'
import { authQueryKeys } from './auth-query-keys'

const { onAuthStateChange } = vi.hoisted(() => ({ onAuthStateChange: vi.fn() }))

vi.mock('../infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    onAuthStateChange,
    signOut: vi.fn(),
  },
}))

function mountListener() {
  const client = createTestQueryClient()
  let emit: AuthStateListener = () => {}
  onAuthStateChange.mockImplementation((listener: AuthStateListener) => {
    emit = listener
    return () => {}
  })

  render(
    <QueryClientProvider client={client}>
      <AuthSessionListener />
    </QueryClientProvider>,
  )

  return { client, emit: (session: AuthSession) => { emit(session); } }
}

describe('AuthSessionListener', () => {
  it('clears server state belonging to the previous user when a different user signs in (A -> B)', () => {
    const { client, emit } = mountListener()

    emit({ userId: 'user-A', email: 'a@habitex.app', expiresAtUnix: null })
    client.setQueryData(['administration', 'A-admin', 'rentals'], ['rental-belonging-to-A'])

    emit({ userId: 'user-B', email: 'b@habitex.app', expiresAtUnix: null })

    expect(client.getQueryData(['administration', 'A-admin', 'rentals'])).toBeUndefined()
    expect(client.getQueryData(authQueryKeys.session)).toEqual({
      userId: 'user-B',
      email: 'b@habitex.app',
      expiresAtUnix: null,
    })
  })

  it('clears the cache on logout and sets the session to null', () => {
    const { client, emit } = mountListener()

    emit({ userId: 'user-A', email: 'a@habitex.app', expiresAtUnix: null })
    client.setQueryData(['administration', 'A-admin', 'rentals'], ['rental-belonging-to-A'])

    emit(null)

    expect(client.getQueryData(['administration', 'A-admin', 'rentals'])).toBeUndefined()
    expect(client.getQueryData(authQueryKeys.session)).toBeNull()
  })

  it('does not clear the cache for the same user (e.g. a token refresh)', () => {
    const { client, emit } = mountListener()

    emit({ userId: 'user-A', email: 'a@habitex.app', expiresAtUnix: 1000 })
    client.setQueryData(['administration', 'A-admin', 'rentals'], ['rental-belonging-to-A'])

    emit({ userId: 'user-A', email: 'a@habitex.app', expiresAtUnix: 2000 })

    expect(client.getQueryData(['administration', 'A-admin', 'rentals'])).toEqual([
      'rental-belonging-to-A',
    ])
  })
})
