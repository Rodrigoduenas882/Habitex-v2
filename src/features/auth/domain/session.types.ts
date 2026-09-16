/**
 * Domain-level representation of an authenticated session, decoupled from
 * Supabase's own Session shape so the rest of the app never depends on it directly.
 */
export type AuthSession = {
  userId: string
  email: string | null
  expiresAtUnix: number | null
} | null

export type AuthStateListener = (session: AuthSession) => void

/**
 * Port for the auth session boundary. Only Supabase Auth itself is wrapped here
 * (getSession/onAuthStateChange/signOut) because that contract is defined by the
 * Supabase SDK we already depend on.
 *
 * The next layer of this flow - Account / Person / Administrations, resolved from
 * this session - depends on a backend schema (tables/RPCs) that does not exist yet
 * in this repository. That layer is intentionally not implemented until the
 * contract is known; do not guess table or RPC names here.
 */
export interface SessionRepository {
  getSession(): Promise<AuthSession>
  onAuthStateChange(listener: AuthStateListener): () => void
  signOut(): Promise<void>
}
