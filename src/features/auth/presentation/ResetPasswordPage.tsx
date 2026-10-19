import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { cx } from '@/shared/lib/cx'
import { HabitexBootScreen } from '@/shared/components/HabitexBootScreen'
import { Alert } from '@/shared/ui/Alert'
import { BrandLogo } from '@/shared/ui/BrandLogo'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { MINIMUM_PASSWORD_LENGTH } from '../domain/password-policy'
import { useRecoverySession } from '../application/useRecoverySession'
import { useUpdatePassword } from '../application/useUpdatePassword'
import { SessionAuthError } from '../domain/session.types'
import styles from './ResetPasswordPage.module.css'

/**
 * Sets a new password from a password-recovery email link.
 *
 * Deliberately NOT wrapped in RedirectIfAuthenticated/ProtectedRoute (see
 * router.tsx's own comment on this route): both guards only ask "does a
 * session exist", which is exactly the question this page must NOT ask -
 * an ordinary already-logged-in visitor must never be able to reach this
 * form just by being authenticated (that would let anyone with an open
 * session silently change their own password while pretending it came
 * through the recovery flow, and - worse - if this route sat inside
 * ProtectedRoute/RequiresAccount, a real recovery session would pass
 * straight through those guards into the dashboard before ever reaching
 * this form). useRecoverySession is the actual gate: 'ready' requires both
 * a detected recovery intent and a session Supabase actually established
 * from it - see that hook's own doc comment for the full reasoning,
 * including why it never trusts a single live event in isolation.
 *
 * On a successful password update, useUpdatePassword itself already signs
 * the recovery session out (see that hook's doc comment) - this page's own
 * job is just to navigate to /login afterward, with a flag the login screen
 * uses to show a one-time success message.
 */
export default function ResetPasswordPage() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()
  const recoverySession = useRecoverySession()
  const updatePassword = useUpdatePassword()

  const schema = z
    .object({
      password: z
        .string()
        .min(MINIMUM_PASSWORD_LENGTH, t('resetPassword.validation.passwordMinLength', { count: MINIMUM_PASSWORD_LENGTH })),
      confirmPassword: z.string().min(1, t('resetPassword.validation.confirmPasswordRequired')),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: t('resetPassword.validation.passwordMismatch'),
      path: ['confirmPassword'],
    })

  type ResetPasswordFormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit((values) => {
    updatePassword.mutate(values.password, {
      onSuccess: () => {
        void navigate('/login', { replace: true, state: { passwordUpdated: true } })
      },
    })
  })

  if (recoverySession.status === 'checking') {
    return <HabitexBootScreen />
  }

  return (
    <div className={styles['page']}>
      <BrandLogo name={t('common:home.title')} />

      <Card className={styles['card']}>
        {recoverySession.status === 'invalid' ? (
          <>
            <div className={styles['header']}>
              <h1 className="text-h2">{t('resetPassword.invalidLink.title')}</h1>
            </div>
            <Alert tone="danger" className={styles['alert']}>
              {t('resetPassword.invalidLink.description')}
            </Alert>
            <p className={cx('text-body-sm', styles['footer'])}>
              <Link to="/forgot-password">{t('resetPassword.invalidLink.requestNew')}</Link>
            </p>
          </>
        ) : (
          <>
            <div className={styles['header']}>
              <h1 className="text-h2">{t('resetPassword.title')}</h1>
              <p className={cx('text-body-sm', 'text-muted', styles['subtitle'])}>
                {t('resetPassword.subtitle')}
              </p>
            </div>

            {updatePassword.isError ? (
              <Alert tone="danger" className={styles['alert']}>
                {t(updatePasswordErrorKey(updatePassword.error))}
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
                type="password"
                label={t('resetPassword.passwordLabel')}
                autoComplete="new-password"
                error={errors.password?.message}
                disabled={updatePassword.isPending}
                {...register('password')}
              />
              <Input
                type="password"
                label={t('resetPassword.confirmPasswordLabel')}
                autoComplete="new-password"
                error={errors.confirmPassword?.message}
                disabled={updatePassword.isPending}
                {...register('confirmPassword')}
              />
              <Button type="submit" loading={updatePassword.isPending} className={styles['submit']}>
                {updatePassword.isPending ? t('resetPassword.submitting') : t('resetPassword.submit')}
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  )
}

/**
 * A switch with an explicit default, never a dynamic `errors.${code}`
 * template key: only the three codes updatePassword can actually produce
 * (see session.types.ts's AuthErrorCode doc comment) get their own copy:
 * invalid_credentials (unreachable here) and any future code both safely
 * fall back to 'unknown' instead of a missing-locale-key runtime surprise.
 */
type ResetPasswordErrorKey =
  | 'resetPassword.errors.weak_password'
  | 'resetPassword.errors.same_password'
  | 'resetPassword.errors.session_expired'
  | 'resetPassword.errors.unknown'

function updatePasswordErrorKey(error: unknown): ResetPasswordErrorKey {
  const code = error instanceof SessionAuthError ? error.code : undefined
  switch (code) {
    case 'weak_password':
      return 'resetPassword.errors.weak_password'
    case 'same_password':
      return 'resetPassword.errors.same_password'
    case 'session_expired':
      return 'resetPassword.errors.session_expired'
    default:
      return 'resetPassword.errors.unknown'
  }
}
