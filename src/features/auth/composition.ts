import type { SessionRepository } from './domain/session.types'
import { supabaseSessionRepository } from './infrastructure/supabase-session.repository'

/**
 * The one place that decides which SessionRepository implementation the
 * rest of the feature gets. application/ and presentation/ depend on the
 * SessionRepository port (domain/session.types.ts) and this binding, never
 * on a concrete adapter's import path directly - swapping Supabase for an
 * HTTP adapter later means changing the line below, not every consumer.
 *
 * Deliberately not a DI container: this feature has exactly one port today,
 * so a single exported binding is the simplest thing that satisfies
 * "consumers depend on the port, not the adapter."
 */
export const sessionRepository: SessionRepository = supabaseSessionRepository
