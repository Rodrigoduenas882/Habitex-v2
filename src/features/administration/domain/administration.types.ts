/** account_status, confirmed against the deployed schema. */
export type AccountStatus = 'ACTIVE' | 'SUSPENDED'

/** administration_status, confirmed against the deployed schema. */
export type AdministrationStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'

export interface Account {
  id: string
  personId: string
  status: AccountStatus
}

/**
 * An administration the current person can access, as exposed by
 * administration_members + administrations RLS. Deliberately does not
 * carry membershipRole/membershipStatus - administration_role and
 * member_status are confirmed enums too, but nothing here needs them yet;
 * add them only when a real use case requires it.
 */
export interface AccessibleAdministration {
  id: string
  name: string
  status: AdministrationStatus
}

/**
 * Wraps a failed Supabase call so nothing above infrastructure/ ever sees a
 * raw PostgrestError. No specific error codes are modeled yet (unlike
 * SessionAuthError) because none have been confirmed against the deployed
 * backend - every failure maps here until real cases are identified.
 */
export class AdministrationContextError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'AdministrationContextError'
    this.cause = cause
  }
}

export interface BootstrapAccountInput {
  fullName: string
  administrationName?: string
}

export interface BootstrapAccountResult {
  personId: string
  accountId: string
  administrationId: string | null
  created: boolean
}

/**
 * Resolves the account belonging to the currently authenticated Supabase
 * Auth user, scoped entirely by RLS (accounts.auth_user_id = auth.uid()) -
 * no id is ever passed in from the caller.
 *
 * Returns null, not an error, when no account row exists yet (e.g. the
 * person authenticated but bootstrap_account() hasn't run) - that is a
 * legitimate state, not a failure.
 */
export interface AccountRepository {
  getCurrentAccount(): Promise<Account | null>

  /**
   * Idempotent on the backend: if the current auth user already has an
   * account, this creates nothing and just returns it (created: false).
   */
  bootstrapAccount(input: BootstrapAccountInput): Promise<BootstrapAccountResult>
}

/**
 * Lists the administrations the current person can access, scoped entirely
 * by RLS (administration_members / administrations via is_administration_member) -
 * no person/account id is ever passed in from the caller. Does not filter
 * or interpret status; callers decide what to do with the full list.
 */
export interface AdministrationRepository {
  listAccessibleAdministrations(): Promise<AccessibleAdministration[]>
}

/** subscription_status, confirmed against the deployed schema. */
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED'

/**
 * An administration_subscriptions row, as exposed by RLS
 * (administration_subscriptions_select: any member of the administration can
 * read it). Timestamps are handed through exactly as the backend returns
 * them - no interval length (trial/grace duration) is ever assumed or
 * computed client-side; callers only ever diff two already-provided dates.
 */
export interface Subscription {
  id: string
  administrationId: string
  status: SubscriptionStatus
  planCode: string
  trialStartedAt: string | null
  trialEndsAt: string | null
  currentPeriodStartsAt: string | null
  currentPeriodEndsAt: string | null
  managementAccessUntil: string | null
  activeRelationshipLimit: number | null
}

/**
 * Resolves the subscription of a given administration, scoped by RLS
 * (administration_subscriptions_select: is_administration_member) on top of
 * the explicit administrationId filter. Returns null, not an error, when no
 * subscription row exists yet for that administration - that is a
 * legitimate state, not a failure.
 */
export interface SubscriptionRepository {
  getSubscription(administrationId: string): Promise<Subscription | null>
}
