/**
 * Domain-level representation of an authenticated session, decoupled from
 * Supabase's own Session shape so the rest of the app never depends on it directly.
 *
 * fullNameFromMetadata is optional (not just nullable): plenty of existing
 * sessions - real ones predating this field, and every test-constructed
 * literal across the suite - never populate it, and nothing should be
 * forced to care. A UX convenience only (pre-filling BootstrapAccountPage's
 * name field) - never treated as verified identity or legal evidence of
 * anything, because Supabase's own user_metadata is writable by the
 * authenticated user themselves via updateUser(), so it can't serve as a
 * trustworthy record on its own (see the separate, still-pending legal
 * consent design for the durable alternative).
 */
export type AuthSession = {
  userId: string
  email: string | null
  expiresAtUnix: number | null
  fullNameFromMetadata?: string | null
} | null

/**
 * Coarse, boundary-safe classification of *why* onAuthStateChange fired -
 * deliberately not Supabase's own AuthChangeEvent union (that would leak the
 * SDK into this domain port, same reasoning as AuthErrorCode below). The
 * only distinction anything above this boundary ever needs today is "did
 * this transition come from a password-recovery link", so everything else
 * folds into 'other'.
 */
export type AuthChangeKind = 'password_recovery' | 'other'

export type AuthStateListener = (session: AuthSession, kind: AuthChangeKind) => void

export interface SessionCredentials {
  email: string
  password: string
}

/**
 * Additive, optional extra data for signUp only - never required, never
 * part of SessionCredentials itself, so every other caller (notably
 * InvitationClaimPage's own sign-up tab, a different flow entirely) keeps
 * calling signUp with exactly {email, password} and needs no change.
 * fullName is stored via Supabase's own official options.data mechanism
 * (user_metadata) purely as a UX convenience for later pre-filling a name
 * field - deliberately NOT a legal-consent carrier (see AuthSession's own
 * doc comment on fullNameFromMetadata for why).
 */
export interface SignUpOptions {
  fullName?: string
}

/**
 * Known, user-facing auth failure categories. Deliberately coarse: we map
 * Supabase's raw error messages down to this small set so the UI never has
 * to see (or accidentally leak) vendor-specific wording, and so a generic
 * "unknown" bucket is the safe default for anything not explicitly handled
 * (rather than exposing details that could help enumerate accounts).
 * weak_password/same_password/session_expired are the exceptions: all three
 * are actionable by the user updating their own password (choose a
 * different password; the recovery link's session simply ran out) rather
 * than account-enumeration-sensitive, so they're worth surfacing precisely.
 */
export type AuthErrorCode = 'invalid_credentials' | 'weak_password' | 'same_password' | 'session_expired' | 'unknown'

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
 * (getSession/signInWithPassword/signUp/onAuthStateChange/signOut) because that
 * contract is defined by the Supabase SDK we already depend on.
 *
 * The next layer of this flow - Account / Person / Administrations, resolved from
 * this session - is implemented separately, in `features/administration/`. This
 * file's own job stays scoped to the auth boundary itself; it does not re-document
 * that other feature's internals.
 */
export interface SessionRepository {
  getSession(): Promise<AuthSession>
  signInWithPassword(credentials: SessionCredentials): Promise<AuthSession>
  /**
   * Creates a new Supabase Auth user via auth.signUp. Verified operationally
   * against this project's local/dev stacks: signUp returns an immediate
   * session when email confirmation is disabled, so the returned
   * AuthSession is populated on success, same as signInWithPassword - but
   * this repo cannot verify the real remote project's confirmation setting
   * (CLAUDE.md §5), so callers must also handle a null session (see
   * SignUpPage's own doc comment for how).
   */
  signUp(credentials: SessionCredentials, options?: SignUpOptions): Promise<AuthSession>
  onAuthStateChange(listener: AuthStateListener): () => void
  signOut(): Promise<void>
  /**
   * Requests a recovery email via auth.resetPasswordForEmail. Always
   * resolves (never throws for "no account with that email" - Supabase
   * itself never distinguishes that case in its response, by design, to
   * avoid account enumeration). Only an actual infra failure (network,
   * rate limit) rejects.
   */
  requestPasswordReset(email: string): Promise<void>
  /**
   * Updates the password of the *currently authenticated* session via
   * auth.updateUser (which returns the updated User, never a Session - the
   * caller already has a session or this call would fail, so there is
   * nothing new to return). Callers are responsible for only invoking this
   * once that session has been confirmed to originate from a
   * password-recovery link (see AuthChangeKind/useRecoverySession) - this
   * method itself has no way to tell a recovery session from an ordinary
   * one, Supabase exposes no such distinction at the updateUser call site.
   */
  updatePassword(newPassword: string): Promise<void>
}
