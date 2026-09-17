import type { AuthError, Session } from '@supabase/supabase-js'
import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  SessionAuthError,
  type AuthSession,
  type AuthStateListener,
  type SessionCredentials,
  type SessionRepository,
} from '../domain/session.types'

function toAuthSession(session: Session | null): AuthSession {
  if (!session) return null

  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    expiresAtUnix: session.expires_at ?? null,
  }
}

/**
 * Translates Supabase's raw AuthError into our own SessionAuthError so
 * nothing above this repository ever depends on Supabase's error shape or
 * wording. Unmatched cases fall back to 'unknown' by design (fail closed on
 * messaging, not just on access).
 */
function toSessionAuthError(error: AuthError): SessionAuthError {
  if (error.message === 'Invalid login credentials') {
    return new SessionAuthError('invalid_credentials', error)
  }

  return new SessionAuthError('unknown', error)
}

// TEMPORARY (remove once real-Supabase latency has been confirmed
// acceptable): logs how long each call actually takes, DEV-only, to tell
// network latency apart from React/Query state issues.
function logTiming(label: string, startedAt: number) {
  if (import.meta.env.DEV) {
    console.info(`[auth-timing] ${label}: ${(performance.now() - startedAt).toFixed(0)}ms`)
  }
}

export const supabaseSessionRepository: SessionRepository = {
  async getSession() {
    const startedAt = performance.now()
    const { data, error } = await supabaseClient.auth.getSession()
    logTiming('getSession', startedAt)

    if (error) {
      throw error
    }

    return toAuthSession(data.session)
  },

  async signInWithPassword({ email, password }: SessionCredentials) {
    const startedAt = performance.now()
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password })
    logTiming('signInWithPassword', startedAt)

    if (error) {
      throw toSessionAuthError(error)
    }

    return toAuthSession(data.session)
  },

  onAuthStateChange(listener: AuthStateListener) {
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (import.meta.env.DEV) {
        console.info(
          `[auth-timing] onAuthStateChange event=${event} userId=${session?.user.id ?? 'null'} at ${performance.now().toFixed(0)}ms`,
        )
      }
      listener(toAuthSession(session))
    })

    return () => {
      subscription.unsubscribe()
    }
  },

  async signOut() {
    const startedAt = performance.now()
    const { error } = await supabaseClient.auth.signOut()
    logTiming('signOut', startedAt)

    if (error) {
      throw error
    }
  },
}
