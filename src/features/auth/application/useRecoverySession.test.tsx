import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getConfirmedRecoveryUserId, setConfirmedRecoveryUserId } from './password-recovery-signal'
import { useRecoverySession } from './useRecoverySession'

const { getSession, onAuthStateChange } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn((_listener: (session: { userId: string } | null) => void) => () => {}),
}))

vi.mock('@/infrastructure/supabase/client', () => ({
  pageLoadedFromPasswordRecoveryLink: false,
  supabaseClient: {},
}))

vi.mock('../infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession,
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    onAuthStateChange,
    signOut: vi.fn(),
    requestPasswordReset: vi.fn(),
    updatePassword: vi.fn(),
  },
}))

afterEach(() => {
  setConfirmedRecoveryUserId(null)
})

describe('useRecoverySession - no recovery intent at all (neither signal ever pinned an identity)', () => {
  it('settles on "invalid" synchronously, without ever calling getSession', async () => {
    const { result } = renderHook(() => useRecoverySession())

    await waitFor(() => {
      expect(result.current.status).toBe('invalid')
    })
    expect(getSession).not.toHaveBeenCalled()
  })
})

describe('useRecoverySession - AuthSessionListener already pinned a confirmed identity', () => {
  it('settles "ready" once getSession confirms the SAME pinned identity', async () => {
    setConfirmedRecoveryUserId('user-recovery')
    getSession.mockResolvedValueOnce({ userId: 'user-recovery', email: 'a@habitex.app', expiresAtUnix: null })
    const { result } = renderHook(() => useRecoverySession())

    expect(result.current.status).toBe('checking')
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
  })

  it('settles "invalid" when the pinned identity no longer matches the current session', async () => {
    setConfirmedRecoveryUserId('user-recovery')
    getSession.mockResolvedValueOnce({ userId: 'someone-else', email: 'b@habitex.app', expiresAtUnix: null })
    const { result } = renderHook(() => useRecoverySession())

    await waitFor(() => {
      expect(result.current.status).toBe('invalid')
    })
  })

  it('settles "invalid" when getSession itself rejects (fails closed)', async () => {
    setConfirmedRecoveryUserId('user-recovery')
    getSession.mockRejectedValueOnce(new Error('network error'))
    const { result } = renderHook(() => useRecoverySession())

    await waitFor(() => {
      expect(result.current.status).toBe('invalid')
    })
  })

  it('reverts "ready" back to "invalid" the moment the live session identity changes away from the pinned one', async () => {
    setConfirmedRecoveryUserId('user-recovery')
    getSession.mockResolvedValueOnce({ userId: 'user-recovery', email: 'a@habitex.app', expiresAtUnix: null })
    const { result } = renderHook(() => useRecoverySession())

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    const registeredListener = onAuthStateChange.mock.calls.at(-1)?.[0]
    expect(registeredListener).toBeDefined()
    registeredListener?.({ userId: 'someone-else' })

    await waitFor(() => {
      expect(result.current.status).toBe('invalid')
    })
  })

  it('reverts "ready" to "invalid" on a plain sign-out (session becomes null) too', async () => {
    setConfirmedRecoveryUserId('user-recovery')
    getSession.mockResolvedValueOnce({ userId: 'user-recovery', email: 'a@habitex.app', expiresAtUnix: null })
    const { result } = renderHook(() => useRecoverySession())

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    const registeredListener = onAuthStateChange.mock.calls.at(-1)?.[0]
    registeredListener?.(null)

    await waitFor(() => {
      expect(result.current.status).toBe('invalid')
    })
  })
})

describe('useRecoverySession - the confirmed identity was cleared by an unrelated normal sign-in before this mount (independent review, HIGH, regression)', () => {
  it('never re-pins a brand new, unrelated identity on remount just because the tab was once on a recovery link - the URL signal is consumed by the module itself, not re-checked here', async () => {
    // Simulates AuthSessionListener having cleared the pin (a normal,
    // unrelated sign-in happened) before THIS hook instance ever mounted -
    // getConfirmedRecoveryUserId() is null, and (in this test file)
    // pageLoadedFromPasswordRecoveryLink is mocked false, so there is
    // nothing at all for a fresh mount to resolve 'ready' from.
    expect(getConfirmedRecoveryUserId()).toBeNull()

    const { result } = renderHook(() => useRecoverySession())

    await waitFor(() => {
      expect(result.current.status).toBe('invalid')
    })
    expect(getSession).not.toHaveBeenCalled()
  })
})
