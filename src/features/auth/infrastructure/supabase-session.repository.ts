import type { Session } from '@supabase/supabase-js'
import { supabaseClient } from '@/infrastructure/supabase/client'
import type { AuthSession, AuthStateListener, SessionRepository } from '../domain/session.types'

function toAuthSession(session: Session | null): AuthSession {
  if (!session) return null

  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    expiresAtUnix: session.expires_at ?? null,
  }
}

export const supabaseSessionRepository: SessionRepository = {
  async getSession() {
    const { data, error } = await supabaseClient.auth.getSession()

    if (error) {
      throw error
    }

    return toAuthSession(data.session)
  },

  onAuthStateChange(listener: AuthStateListener) {
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      listener(toAuthSession(session))
    })

    return () => {
      subscription.unsubscribe()
    }
  },

  async signOut() {
    const { error } = await supabaseClient.auth.signOut()

    if (error) {
      throw error
    }
  },
}
