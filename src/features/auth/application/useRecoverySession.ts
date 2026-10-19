import { useEffect, useState } from 'react'
import { pageLoadedFromPasswordRecoveryLink } from '@/infrastructure/supabase/client'
import { sessionRepository } from '../composition'
import { consumeUrlRecoverySignalOnce, getConfirmedRecoveryUserId, setConfirmedRecoveryUserId } from './password-recovery-signal'

export type RecoverySessionState = { status: 'checking' } | { status: 'invalid' } | { status: 'ready' }

/**
 * Gates ResetPasswordPage on an actual, currently-usable recovery session -
 * never on "some session exists" (a normal logged-in visitor must never be
 * able to reach the set-new-password form just by being authenticated; see
 * ResetPasswordPage's own doc comment). 'ready' requires a session confirmed
 * to have come specifically from a password-recovery transition, pinned by
 * its exact userId (password-recovery-signal.ts) - not merely "a session
 * exists right now", and not merely "this tab once saw a recovery hash".
 *
 * Two independent signals can establish that pin (see
 * pageLoadedFromPasswordRecoveryLink/password-recovery-signal.ts for why
 * both exist - a live PASSWORD_RECOVERY event can be missed by a listener
 * that mounts too late):
 *  1. AuthSessionListener already observed the live event and called
 *     setConfirmedRecoveryUserId - checked first, authoritative whenever
 *     present.
 *  2. Falling back to this tab's original URL hash
 *     (pageLoadedFromPasswordRecoveryLink), consumed via
 *     consumeUrlRecoverySignalOnce() - AT MOST ONCE per tab lifetime, and
 *     only when (1) hasn't already pinned anything. Without that one-time
 *     consumption, a tab that ever loaded a recovery link could, after the
 *     pinned identity is later cleared by an unrelated normal sign-in
 *     (AuthSessionListener), remount /reset-password again and re-pin
 *     WHATEVER session happens to be active then - independent review
 *     (HIGH) found the first version of this fix still had exactly this
 *     gap, closed by making signal (2) single-use for the whole tab.
 *
 * Checks getSession() directly (not the shared useAuthSession() query
 * cache) only when neither signal has already pinned an identity: the
 * cache is populated by AuthSessionListener reacting to this same event,
 * and may not have been written yet on this page's very first render -
 * calling the SDK directly (which internally awaits its own initialization
 * before resolving) is the only way to get a definitive answer without a
 * race.
 */
export function useRecoverySession(): RecoverySessionState {
  const [state, setState] = useState<RecoverySessionState>(() =>
    getConfirmedRecoveryUserId() !== null || pageLoadedFromPasswordRecoveryLink ? { status: 'checking' } : { status: 'invalid' },
  )

  useEffect(() => {
    if (state.status !== 'checking') {
      return
    }

    let cancelled = false
    const alreadyPinnedUserId = getConfirmedRecoveryUserId()

    sessionRepository
      .getSession()
      .then((session) => {
        if (cancelled) return

        if (alreadyPinnedUserId !== null) {
          setState({ status: session?.userId === alreadyPinnedUserId ? 'ready' : 'invalid' })
          return
        }

        if (session && consumeUrlRecoverySignalOnce()) {
          setConfirmedRecoveryUserId(session.userId)
          setState({ status: 'ready' })
          return
        }

        setState({ status: 'invalid' })
      })
      .catch(() => {
        if (cancelled) return
        setState({ status: 'invalid' })
      })

    return () => {
      cancelled = true
    }
  }, [state.status])

  useEffect(() => {
    if (state.status !== 'ready') {
      return
    }

    return sessionRepository.onAuthStateChange((session) => {
      if (session?.userId !== getConfirmedRecoveryUserId()) {
        setState({ status: 'invalid' })
      }
    })
  }, [state.status])

  return state
}
