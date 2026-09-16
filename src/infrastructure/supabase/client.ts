import { createClient } from '@supabase/supabase-js'
import { env } from '@/shared/lib/env'

/**
 * The only place in the app allowed to talk to Supabase directly.
 * Every other layer must go through a repository/adapter that wraps this client.
 */
export const supabaseClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
