import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import type { AuthSession, AuthStateListener } from '../domain/session.types'
import { AuthSessionListener } from './AuthSessionListener'
import { authQueryKeys } from './auth-query-keys'

const SELECTED_ADMINISTRATION_STORAGE_KEY = 'habitex:selected-administration-id'

const { onAuthStateChange } = vi.hoisted(() => ({ onAuthStateChange: vi.fn() }))

vi.mock('../infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    onAuthStateChange,
    signOut: vi.fn(),
  },
}))

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  window.localStorage.clear()
})

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

  /**
   * Regression coverage for the administration-context queries specifically
   * (features/administration/application/administration-query-keys.ts) -
   * they live under ['account', ...] / ['administrations', ...], not
   * ['auth', ...], precisely so this listener sweeps them like any other
   * business data on identity change, with no extra cleanup code needed.
   */
  it('clears account/administrations-context data belonging to the previous user (A -> B)', () => {
    const { client, emit } = mountListener()

    emit({ userId: 'user-A', email: 'a@habitex.app', expiresAtUnix: null })
    client.setQueryData(['account'], { id: 'acc-A', personId: 'person-A', status: 'some-status' })
    client.setQueryData(
      ['administrations', 'accessible'],
      [{ id: 'admin-A', name: 'Administración de A', status: 'some-status' }],
    )

    emit({ userId: 'user-B', email: 'b@habitex.app', expiresAtUnix: null })

    expect(client.getQueryData(['account'])).toBeUndefined()
    expect(client.getQueryData(['administrations', 'accessible'])).toBeUndefined()
  })

  /**
   * Regression coverage for a HIGH finding: the persisted administration
   * selection (administration-selection-storage.ts) lives in localStorage,
   * outside the query cache, so it was never swept by this listener's
   * removeQueries() cleanup above. On an identity change in the same tab
   * (logout of A -> login of B, no reload - a flow ARCHITECTURE.md §7
   * explicitly supports), a stale id A left behind could resolve
   * useActiveAdministration straight to 'resolved' for B without B ever
   * choosing it themselves - even when B also has legitimate access to that
   * same administration (e.g. co-administrators) - violating the "never
   * auto-pick" invariant documented on useCurrentAdministration.ts and
   * useActiveAdministration.ts.
   */
  it('clears the persisted administration selection when a different user signs in (A -> B), even if B can access the same administration', () => {
    const { emit } = mountListener()

    emit({ userId: 'user-A', email: 'a@habitex.app', expiresAtUnix: null })
    window.localStorage.setItem(SELECTED_ADMINISTRATION_STORAGE_KEY, 'shared-admin')

    emit({ userId: 'user-B', email: 'b@habitex.app', expiresAtUnix: null })

    expect(window.localStorage.getItem(SELECTED_ADMINISTRATION_STORAGE_KEY)).toBeNull()
  })

  it('clears the persisted administration selection on logout', () => {
    const { emit } = mountListener()

    emit({ userId: 'user-A', email: 'a@habitex.app', expiresAtUnix: null })
    window.localStorage.setItem(SELECTED_ADMINISTRATION_STORAGE_KEY, 'admin-1')

    emit(null)

    expect(window.localStorage.getItem(SELECTED_ADMINISTRATION_STORAGE_KEY)).toBeNull()
  })

  it('does not clear the persisted administration selection for the same user (e.g. a token refresh)', () => {
    const { emit } = mountListener()

    emit({ userId: 'user-A', email: 'a@habitex.app', expiresAtUnix: 1000 })
    window.localStorage.setItem(SELECTED_ADMINISTRATION_STORAGE_KEY, 'admin-1')

    emit({ userId: 'user-A', email: 'a@habitex.app', expiresAtUnix: 2000 })

    expect(window.localStorage.getItem(SELECTED_ADMINISTRATION_STORAGE_KEY)).toBe('admin-1')
  })
})
