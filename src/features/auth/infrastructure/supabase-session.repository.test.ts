import { describe, expect, it, vi } from 'vitest'
import { SessionAuthError } from '../domain/session.types'

const { signUp, signInWithPassword, resetPasswordForEmail, updateUser, onAuthStateChange } = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  onAuthStateChange: vi.fn((_callback: (event: string, session: unknown) => void) => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
}))

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: {
    auth: {
      signUp,
      signInWithPassword,
      getSession: vi.fn(),
      onAuthStateChange,
      signOut: vi.fn(),
      resetPasswordForEmail,
      updateUser,
    },
  },
}))

import { supabaseSessionRepository } from './supabase-session.repository'

const CREDENTIALS = { email: 'new@habitex.app', password: 'secret123' }

describe('supabaseSessionRepository.signUp', () => {
  it('calls auth.signUp with exactly the given email/password', async () => {
    signUp.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'new@habitex.app' }, expires_at: 1234 } },
      error: null,
    })

    await supabaseSessionRepository.signUp(CREDENTIALS)

    expect(signUp).toHaveBeenCalledWith({ email: 'new@habitex.app', password: 'secret123' })
  })

  it('maps a returned session into domain AuthSession shape, mirroring signInWithPassword', async () => {
    signUp.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'new@habitex.app' }, expires_at: 1234 } },
      error: null,
    })

    const result = await supabaseSessionRepository.signUp(CREDENTIALS)

    expect(result).toEqual({ userId: 'user-1', email: 'new@habitex.app', expiresAtUnix: 1234 })
  })

  it('maps a null session (no immediate session case) to null, without throwing', async () => {
    signUp.mockResolvedValueOnce({ data: { session: null }, error: null })

    const result = await supabaseSessionRepository.signUp(CREDENTIALS)

    expect(result).toBeNull()
  })

  it('maps a user_already_exists error (email already registered) to code unknown, folded deliberately - see this function\'s own doc comment', async () => {
    signUp.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'User already registered', code: 'user_already_exists' },
    })

    const error = await supabaseSessionRepository.signUp(CREDENTIALS).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SessionAuthError)
    expect((error as SessionAuthError).code).toBe('unknown')
  })

  it('maps any other error to code unknown, never leaking vendor wording', async () => {
    signUp.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Something else went wrong', code: 'unexpected_failure' },
    })

    const error = await supabaseSessionRepository.signUp(CREDENTIALS).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SessionAuthError)
    expect((error as SessionAuthError).code).toBe('unknown')
  })
})

describe('supabaseSessionRepository.requestPasswordReset', () => {
  it('calls auth.resetPasswordForEmail with the given email and a fixed, same-origin redirectTo', async () => {
    resetPasswordForEmail.mockResolvedValueOnce({ error: null })

    await supabaseSessionRepository.requestPasswordReset('propietario@habitex.app')

    expect(resetPasswordForEmail).toHaveBeenCalledWith('propietario@habitex.app', {
      redirectTo: `${window.location.origin}/reset-password`,
    })
  })

  it('resolves without throwing even when Supabase reports no error - the no-account case looks identical by design', async () => {
    resetPasswordForEmail.mockResolvedValueOnce({ error: null })

    await expect(supabaseSessionRepository.requestPasswordReset('nadie@habitex.app')).resolves.toBeUndefined()
  })

  it('throws on an actual infra failure', async () => {
    resetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'Rate limit exceeded', code: 'over_email_send_rate_limit' } })

    await expect(supabaseSessionRepository.requestPasswordReset('propietario@habitex.app')).rejects.toBeTruthy()
  })
})

describe('supabaseSessionRepository.updatePassword', () => {
  it('calls auth.updateUser with the new password', async () => {
    updateUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })

    await supabaseSessionRepository.updatePassword('new-secret-123')

    expect(updateUser).toHaveBeenCalledWith({ password: 'new-secret-123' })
  })

  it('maps a weak_password error to AuthErrorCode weak_password', async () => {
    updateUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Password is too weak', code: 'weak_password' } })

    const error = await supabaseSessionRepository.updatePassword('123').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SessionAuthError)
    expect((error as SessionAuthError).code).toBe('weak_password')
  })

  it('maps a same_password error to AuthErrorCode same_password', async () => {
    updateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'New password should be different', code: 'same_password' },
    })

    const error = await supabaseSessionRepository.updatePassword('old-secret').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SessionAuthError)
    expect((error as SessionAuthError).code).toBe('same_password')
  })

  it('maps a session_not_found error to AuthErrorCode session_expired', async () => {
    updateUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Session not found', code: 'session_not_found' } })

    const error = await supabaseSessionRepository.updatePassword('new-secret-123').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SessionAuthError)
    expect((error as SessionAuthError).code).toBe('session_expired')
  })
})

describe('supabaseSessionRepository.onAuthStateChange', () => {
  it('passes through a PASSWORD_RECOVERY event as AuthChangeKind "password_recovery"', () => {
    const listener = vi.fn()
    supabaseSessionRepository.onAuthStateChange(listener)

    const registeredCallback = onAuthStateChange.mock.calls.at(-1)?.[0] as (event: string, session: unknown) => void
    registeredCallback('PASSWORD_RECOVERY', { user: { id: 'user-1', email: 'a@habitex.app' }, expires_at: 1 })

    expect(listener).toHaveBeenCalledWith(
      { userId: 'user-1', email: 'a@habitex.app', expiresAtUnix: 1 },
      'password_recovery',
    )
  })

  it('maps every other event to AuthChangeKind "other"', () => {
    const listener = vi.fn()
    supabaseSessionRepository.onAuthStateChange(listener)

    const registeredCallback = onAuthStateChange.mock.calls.at(-1)?.[0] as (event: string, session: unknown) => void
    registeredCallback('SIGNED_IN', { user: { id: 'user-1', email: 'a@habitex.app' }, expires_at: 1 })

    expect(listener).toHaveBeenCalledWith(
      { userId: 'user-1', email: 'a@habitex.app', expiresAtUnix: 1 },
      'other',
    )
  })
})
