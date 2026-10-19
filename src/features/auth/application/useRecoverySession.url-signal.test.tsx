import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setConfirmedRecoveryUserId } from './password-recovery-signal'
import { useRecoverySession } from './useRecoverySession'

// Separate file, its own module mock: pageLoadedFromPasswordRecoveryLink is
// true for every test here (the tab's original load had a recovery hash) -
// useRecoverySession.test.tsx covers the false case and the
// AuthSessionListener-already-pinned case; this file's whole point is the
// URL-signal fallback path and its one-time consumption
// (consumeUrlRecoverySignalOnce, in password-recovery-signal.ts), which
// can only be exercised with this flag genuinely true.
vi.mock('@/infrastructure/supabase/client', () => ({
  pageLoadedFromPasswordRecoveryLink: true,
  supabaseClient: {},
}))

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('../infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession,
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    onAuthStateChange: vi.fn(() => () => {}),
    signOut: vi.fn(),
    requestPasswordReset: vi.fn(),
    updatePassword: vi.fn(),
  },
}))

afterEach(() => {
  setConfirmedRecoveryUserId(null)
})

describe('useRecoverySession - URL signal fallback (AuthSessionListener never pinned anything)', () => {
  it('pins whichever identity getSession confirms on the FIRST mount that ever consults it, resolving "ready"', async () => {
    getSession.mockResolvedValueOnce({ userId: 'user-A', email: 'a@habitex.app', expiresAtUnix: null })
    const { result } = renderHook(() => useRecoverySession())

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
  })

  it('independent review (HIGH) regression: a LATER remount never re-pins a different identity from the same stale URL signal, even though pageLoadedFromPasswordRecoveryLink is still true for this tab', async () => {
    // The previous test already consumed the one-time URL signal (module
    // state, shared across this file's tests by design - mirrors a single
    // continuous tab's lifetime). Simulates: AuthSessionListener cleared
    // the pin after an unrelated normal sign-in (setConfirmedRecoveryUserId
    // reset to null by this file's own afterEach, standing in for that),
    // and the user now navigates back to /reset-password a second time.
    getSession.mockResolvedValueOnce({ userId: 'user-B-unrelated', email: 'b@habitex.app', expiresAtUnix: null })
    const { result } = renderHook(() => useRecoverySession())

    await waitFor(() => {
      expect(result.current.status).toBe('invalid')
    })
  })
})
