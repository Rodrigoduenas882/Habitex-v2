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

export interface SessionCredentials {
  email: string
  password: string
}

/**
 * Known, user-facing auth failure categories. Deliberately coarse: we map
 * Supabase's raw error messages down to this small set so the UI never has
 * to see (or accidentally leak) vendor-specific wording, and so a generic
 * "unknown" bucket is the safe default for anything not explicitly handled
 * (rather than exposing details that could help enumerate accounts).
 */
export type AuthErrorCode = 'invalid_credentials' | 'unknown'

export class SessionAuthError extends Error {
  readonly code: AuthErrorCode

  constructor(code: AuthErrorCode, cause?: unknown) {
    super(`Auth error: ${code}`)
    this.name = 'SessionAuthError'
    this.code = code
    this.cause = cause
  }
}

/**
 * Port for the auth session boundary. Only Supabase Auth itself is wrapped here
 * (getSession/signInWithPassword/onAuthStateChange/signOut) because that contract
 * is defined by the Supabase SDK we already depend on.
 *
 * The next layer of this flow - Account / Person / Administrations, resolved from
 * this session - depends on a backend schema (tables/RPCs) that does not exist yet
 * in this repository. That layer is intentionally not implemented until the
 * contract is known; do not guess table or RPC names here.
 */
export interface SessionRepository {
  getSession(): Promise<AuthSession>
  signInWithPassword(credentials: SessionCredentials): Promise<AuthSession>
  onAuthStateChange(listener: AuthStateListener): () => void
  signOut(): Promise<void>
}
