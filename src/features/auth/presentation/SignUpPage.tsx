import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { cx } from '@/shared/lib/cx'
import { Alert } from '@/shared/ui/Alert'
import { BrandLogo } from '@/shared/ui/BrandLogo'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { MINIMUM_PASSWORD_LENGTH } from '../domain/password-policy'
import { useSignUp } from '../application/useSignUp'
import styles from './SignUpPage.module.css'

/**
 * Public registration for a brand-new owner - the one piece the MVP-closure
 * audit found missing. Everything this page calls already existed and is
 * reused exactly as-is: useSignUp, bootstrap_account, the 14-day trial
 * trigger. Standalone, no AppShell - same reasoning as BootstrapAccountPage
 * (nothing to show in a shell nav before an Account exists).
 *
 * Two outcomes after a successful signUp, both already representable by the
 * existing AuthSession | null domain type with no change to it:
 *  - Supabase returns a session immediately (email confirmation disabled -
 *    true on this project's dev stacks, unverifiable for the real remote
 *    project from this repo, see CLAUDE.md §5) -> nothing further to do
 *    here: this route sits under RedirectIfAuthenticated (router.tsx), which
 *    reacts to the same query-cache write useSignUp's onSuccess already
 *    performs and navigates away on its own - identical to how
 *    InvitationClaimPage's own sign-up tab already behaves, never
 *    duplicated here.
 *  - Supabase returns session: null (email confirmation required) -> show
 *    a "check your email" state instead, and never retry/resubmit from it.
 *
 * firstName/lastName are concatenated into one fullName string before
 * being sent - people.full_name stays a single column (verified: nothing
 * else in this codebase reads a split name), and the concatenated value is
 * passed to signUp's own fullName option, which Supabase stores in
 * user_metadata purely as a UX convenience for BootstrapAccountPage to
 * pre-fill later (see that page's own doc comment) - never as legal
 * evidence of anything.
 */
export default function SignUpPage() {
  const { t } = useTranslation(['auth', 'common'])
  const signUp = useSignUp()

  const schema = z
    .object({
      firstName: z.string().trim().min(1, t('signup.validation.firstNameRequired')),
      lastName: z.string().trim().min(1, t('signup.validation.lastNameRequired')),
      email: z
        .string()
        .min(1, t('signup.validation.emailRequired'))
        .pipe(z.email(t('signup.validation.emailInvalid'))),
      password: z.string().min(MINIMUM_PASSWORD_LENGTH, t('signup.validation.passwordMinLength', { count: MINIMUM_PASSWORD_LENGTH })),
      confirmPassword: z.string().min(1, t('signup.validation.confirmPasswordRequired')),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: t('signup.validation.passwordMismatch'),
      path: ['confirmPassword'],
    })

  type SignUpFormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormValues>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit((values) => {
    signUp.mutate({
      email: values.email,
      password: values.password,
      fullName: `${values.firstName.trim()} ${values.lastName.trim()}`,
    })
  })

  const confirmationRequired = signUp.isSuccess && signUp.data === null

  return (
    <div className={styles['page']}>
      <BrandLogo name={t('common:home.title')} />

      <Card className={styles['card']}>
        {confirmationRequired ? (
          <>
            <div className={styles['header']}>
              <h1 className="text-h2">{t('signup.confirmEmail.title')}</h1>
              <p className={cx('text-body-sm', 'text-muted', styles['subtitle'])}>
                {t('signup.confirmEmail.description')}
              </p>
            </div>
            <Alert tone="success">{t('signup.confirmEmail.alert')}</Alert>
          </>
        ) : (
          <>
            <div className={styles['header']}>
              <h1 className="text-h2">{t('signup.title')}</h1>
              <p className={cx('text-body-sm', 'text-muted', styles['subtitle'])}>{t('signup.subtitle')}</p>
            </div>

            {signUp.isError ? (
              <Alert tone="danger" className={styles['alert']}>
                {/* signUp only ever surfaces 'unknown' in practice (a
                    duplicate email is deliberately folded into it - see
                    supabase-session.repository.ts's own doc comment, anti
                    account-enumeration), so there is nothing to branch on. */}
                {t('signup.errors.unknown')}
              </Alert>
            ) : null}

            <form
              onSubmit={(event) => {
                void onSubmit(event)
              }}
              noValidate
              className={styles['form']}
            >
              <Input
                label={t('signup.firstNameLabel')}
                autoComplete="given-name"
                error={errors.firstName?.message}
                disabled={signUp.isPending}
                {...register('firstName')}
              />
              <Input
                label={t('signup.lastNameLabel')}
                autoComplete="family-name"
                error={errors.lastName?.message}
                disabled={signUp.isPending}
                {...register('lastName')}
              />
              <Input
                type="email"
                label={t('signup.emailLabel')}
                autoComplete="email"
                error={errors.email?.message}
                disabled={signUp.isPending}
                {...register('email')}
              />
              <Input
                type="password"
                label={t('signup.passwordLabel')}
                autoComplete="new-password"
                error={errors.password?.message}
                disabled={signUp.isPending}
                {...register('password')}
              />
              <Input
                type="password"
                label={t('signup.confirmPasswordLabel')}
                autoComplete="new-password"
                error={errors.confirmPassword?.message}
                disabled={signUp.isPending}
                {...register('confirmPassword')}
              />
              <Button type="submit" loading={signUp.isPending} className={styles['submit']}>
                {signUp.isPending ? t('signup.submitting') : t('signup.submit')}
              </Button>
            </form>

            <p className={cx('text-body-sm', styles['footer'])}>
              {t('signup.loginPrompt')} <Link to="/login">{t('signup.loginLink')}</Link>
            </p>
          </>
        )}
      </Card>
    </div>
  )
}
