import { describe, expect, it, vi } from 'vitest'
import { SessionAuthError } from '../domain/session.types'

const { signUp, signInWithPassword } = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
}))

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: {
    auth: {
      signUp,
      signInWithPassword,
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn(),
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
