import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation, type UseTranslationResponse } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
// Cross-feature imports, same precedent as DashboardPage/AuthenticatedLayout
// already importing features/auth/application/* directly - session state is
// a cross-cutting concern, not something this feature re-implements. Reused
// exactly as exported, never redefined/modified.
import { useAuthSession } from '@/features/auth/application/useAuthSession'
import { useLogin } from '@/features/auth/application/useLogin'
import { useSignUp } from '@/features/auth/application/useSignUp'
import type { SessionAuthError } from '@/features/auth/domain/session.types'
import { cx } from '@/shared/lib/cx'
import { Alert } from '@/shared/ui/Alert'
import { BrandLogo } from '@/shared/ui/BrandLogo'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Tabs } from '@/shared/ui/Tabs'
import { useClaimInvitation } from '../application/useClaimInvitation'
import { InvitationRepositoryError, type InvitationErrorCode } from '../domain/invitation.types'
import styles from './InvitationClaimPage.module.css'

type InvitationsT = UseTranslationResponse<['invitations', 'auth', 'common'], undefined>['t']

/**
 * Maps every InvitationErrorCode to a short, non-disclosing message
 * (human-approved copy, do not deviate) - deliberately exhaustive even
 * though 'management_access_required'/'tenant_not_linked' are create-side
 * only and unreachable through claim_tenant_invitation, and
 * 'authentication_required' never actually surfaces here (the claim action
 * is only rendered once authenticated - see InvitationClaimAction below).
 */
function claimErrorMessage(t: InvitationsT, code: InvitationErrorCode): string {
  switch (code) {
    case 'invalid_token':
      return t('claim.errors.invalid_token')
    case 'expired':
      return t('claim.errors.expired')
    case 'already_claimed':
      return t('claim.errors.already_claimed')
    case 'account_conflict':
      return t('claim.errors.account_conflict')
    case 'authentication_required':
    case 'management_access_required':
    case 'tenant_not_linked':
    case 'unknown':
      return t('claim.errors.unknown')
  }
}

/**
 * The inline "Ya tengo cuenta" form - useLogin() exactly as LoginPage.tsx
 * uses it, reusing that same page's auth:login.errors.* copy directly
 * (mirrors LoginPage's own `login.errors.${code}` lookup, just namespaced
 * explicitly since this page's default namespace is 'invitations'). A
 * successful login writes the session into the shared query cache
 * (useLogin's own onSuccess), so InvitationClaimPage re-renders into its
 * authenticated branch reactively - this form never needs its own
 * "onAuthenticated" callback.
 */
function InvitationLoginForm() {
  const { t } = useTranslation(['invitations', 'auth'])
  const login = useLogin()

  const schema = z.object({
    email: z
      .string()
      .min(1, t('auth.login.validation.emailRequired'))
      .pipe(z.email(t('auth.login.validation.emailInvalid'))),
    password: z.string().min(1, t('auth.login.validation.passwordRequired')),
  })
  type LoginFormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit((values) => {
    login.mutate(values)
  })

  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event)
      }}
      noValidate
      className={styles['form']}
    >
      <Input
        type="email"
        label={t('auth.login.emailLabel')}
        autoComplete="email"
        error={errors.email?.message}
        disabled={login.isPending}
        {...register('email')}
      />
      <Input
        type="password"
        label={t('auth.login.passwordLabel')}
        autoComplete="current-password"
        error={errors.password?.message}
        disabled={login.isPending}
        {...register('password')}
      />
      <Button type="submit" loading={login.isPending} className={styles['submit']}>
        {login.isPending ? t('auth.login.submitting') : t('auth.login.submit')}
      </Button>
      {login.isError ? <Alert tone="danger">{t(`auth:login.errors.${login.error.code}`)}</Alert> : null}
    </form>
  )
}

/**
 * The inline "Crear cuenta" form - useSignUp() exactly as it's exported by
 * features/auth/application, unmodified. Same reactive-cache handoff
 * principle as InvitationLoginForm above: a successful sign-up writes the
 * new session into the shared query cache, so this page re-renders into its
 * authenticated branch on its own.
 */
function InvitationSignUpForm() {
  const { t } = useTranslation('invitations')
  const signUp = useSignUp()

  const schema = z.object({
    email: z
      .string()
      .min(1, t('auth.signup.validation.emailRequired'))
      .pipe(z.email(t('auth.signup.validation.emailInvalid'))),
    password: z.string().min(1, t('auth.signup.validation.passwordRequired')),
  })
  type SignUpFormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormValues>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit((values) => {
    signUp.mutate(values)
  })

  const errorCode: SessionAuthError['code'] | null = signUp.isError ? signUp.error.code : null

  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event)
      }}
      noValidate
      className={styles['form']}
    >
      <Input
        type="email"
        label={t('auth.signup.emailLabel')}
        autoComplete="email"
        error={errors.email?.message}
        disabled={signUp.isPending}
        {...register('email')}
      />
      <Input
        type="password"
        label={t('auth.signup.passwordLabel')}
        autoComplete="new-password"
        error={errors.password?.message}
        disabled={signUp.isPending}
        {...register('password')}
      />
      <Button type="submit" loading={signUp.isPending} className={styles['submit']}>
        {signUp.isPending ? t('auth.signup.submitting') : t('auth.signup.submit')}
      </Button>
      {errorCode ? <Alert tone="danger">{t(`auth.signup.errors.${errorCode}`)}</Alert> : null}
    </form>
  )
}

interface InvitationClaimActionProps {
  token: string
}

/**
 * Only rendered once authenticated (see InvitationClaimPage below) - never
 * auto-claims. claim_tenant_invitation only ever runs from this explicit
 * button click. On success, navigates to '/' (replace) - the destination
 * page reflects the newly-created account/link on its own, so no
 * intermediate success screen is needed. On a non-retriable failure
 * (already_claimed/expired - a fixed timestamp/one-time token that retrying
 * cannot change), the button is hidden entirely rather than left enabled for
 * a retry that can never succeed.
 */
function InvitationClaimAction({ token }: InvitationClaimActionProps) {
  const { t } = useTranslation(['invitations', 'auth', 'common'])
  const navigate = useNavigate()
  const claimInvitation = useClaimInvitation()

  const handleClick = () => {
    claimInvitation.mutate(token, {
      onSuccess: () => {
        void navigate('/', { replace: true })
      },
    })
  }

  const errorCode: InvitationErrorCode | null = claimInvitation.isError
    ? claimInvitation.error instanceof InvitationRepositoryError
      ? claimInvitation.error.code
      : 'unknown'
    : null
  const errorMessage = errorCode ? claimErrorMessage(t, errorCode) : null
  const nonRetriable = errorCode === 'already_claimed' || errorCode === 'expired'

  return (
    <div className={styles['claimSection']}>
      <p className="text-body-sm text-muted">{t('claim.explanation')}</p>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {!nonRetriable ? (
        <Button
          type="button"
          loading={claimInvitation.isPending}
          disabled={claimInvitation.isPending}
          onClick={handleClick}
          className={styles['submit']}
        >
          {claimInvitation.isPending ? t('claim.accepting') : t('claim.accept')}
        </Button>
      ) : null}
    </div>
  )
}

/**
 * /invitations/:token - public on purpose (see router.tsx's own comment on
 * this route entry): a brand-new tenant has no session/Account yet the
 * first time they open this link, so this page is deliberately outside
 * ProtectedRoute/RequiresAccount and never assumes either.
 *
 * State machine:
 *  - no token in the URL -> generic invalid-link copy (same message as an
 *    invalid token discovered at claim time - never distinguishes the two).
 *  - session unknown (useAuthSession().isLoading) -> Skeleton.
 *  - unauthenticated (including a session-lookup failure - same fail-closed
 *    "unknown is never treated as authenticated" rule as ProtectedRoute) ->
 *    inline "Ya tengo cuenta" / "Crear cuenta" toggle, never a redirect to
 *    /login (which has no mechanism to preserve the token and bounce back).
 *  - authenticated -> InvitationClaimAction (explicit "Aceptar invitación"
 *    click only - see that component's own doc comment).
 *
 * No invitation detail is ever read before the explicit claim click (no
 * public pre-auth lookup) - this page renders the same generic UI
 * regardless of whether the token is valid until the claim attempt itself
 * runs.
 */
export default function InvitationClaimPage() {
  const { t } = useTranslation(['invitations', 'auth', 'common'])
  const { token } = useParams<{ token: string }>()
  const authSession = useAuthSession()

  if (!token) {
    return (
      <div className={styles['page']}>
        <Card className={styles['card']}>
          <Alert tone="danger" title={t('claim.invalidLink.title')}>
            {t('claim.errors.invalid_token')}
          </Alert>
        </Card>
      </div>
    )
  }

  if (authSession.isLoading) {
    return (
      <div className={styles['page']} data-testid="invitation-claim-loading">
        <Skeleton height={32} width={240} />
        <Skeleton height={160} radius="lg" />
      </div>
    )
  }

  return (
    <div className={styles['page']}>
      <BrandLogo name={t('common:home.title')} />

      <Card className={styles['card']}>
        {!authSession.data ? (
          <>
            <div className={styles['header']}>
              <h1 className="text-h2">{t('auth.title')}</h1>
              <p className={cx('text-body-sm', 'text-muted', styles['subtitle'])}>{t('auth.description')}</p>
            </div>
            <Tabs
              ariaLabel={t('auth.tabs.ariaLabel')}
              items={[
                { value: 'login', label: t('auth.tabs.login'), content: <InvitationLoginForm /> },
                { value: 'signup', label: t('auth.tabs.signup'), content: <InvitationSignUpForm /> },
              ]}
            />
          </>
        ) : (
          <>
            <div className={styles['header']}>
              <h1 className="text-h2">{t('claim.title')}</h1>
            </div>
            <InvitationClaimAction token={token} />
          </>
        )}
      </Card>
    </div>
  )
}
