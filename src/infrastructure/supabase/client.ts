import { createClient } from '@supabase/supabase-js'
import { env } from '@/shared/lib/env'

/**
 * Captured synchronously, at module evaluation - before `createClient()`
 * below has a chance to run its own (async) URL-hash processing, which
 * strips this same fragment from the address bar as a side effect. This is
 * the only timing-safe way to know a page load originated from a
 * password-recovery link: Supabase's implicit flow (the flowType this
 * project uses, verified in auth-js's own GoTrueClient default) emits a
 * PASSWORD_RECOVERY event to whichever onAuthStateChange listeners happen
 * to already be subscribed at the exact moment it finishes parsing the URL
 * - late subscribers (e.g. a listener mounted via a React effect, which
 * only runs after first paint) can and do miss it, receiving a generic
 * INITIAL_SESSION instead with no way to tell it apart from an ordinary
 * already-logged-in session. Reading the raw URL here has no such race.
 * Never logged, never stored beyond this boolean - only the *presence* of
 * `type=recovery` is read, never the actual access/refresh tokens.
 */
export const pageLoadedFromPasswordRecoveryLink = /(^|[#&])type=recovery(&|$)/.test(window.location.hash)

/**
 * The only place in the app allowed to talk to Supabase directly.
 * Every other layer must go through a repository/adapter that wraps this client.
 */
export const supabaseClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
