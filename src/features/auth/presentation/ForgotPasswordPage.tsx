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
import { useRequestPasswordReset } from '../application/useRequestPasswordReset'
import styles from './ForgotPasswordPage.module.css'

/**
 * Requests a recovery email via the official auth.resetPasswordForEmail
 * (see SessionRepository.requestPasswordReset). Always shows the exact same
 * success state once the request completes without an infra error -
 * regardless of whether the email actually belongs to an account - because
 * Supabase itself never distinguishes those two cases in its response. A
 * form that branched its UI on "account not found" would be the actual
 * enumeration vector; the single success state is the fix, not a
 * simplification.
 */
export default function ForgotPasswordPage() {
  const { t } = useTranslation(['auth', 'common'])
  const requestReset = useRequestPasswordReset()

  const schema = z.object({
    email: z
      .string()
      .min(1, t('forgotPassword.validation.emailRequired'))
      .pipe(z.email(t('forgotPassword.validation.emailInvalid'))),
  })

  type ForgotPasswordFormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit((values) => {
    requestReset.mutate(values.email)
  })

  return (
    <div className={styles['page']}>
      <BrandLogo name={t('common:home.title')} />

      <Card className={styles['card']}>
        {requestReset.isSuccess ? (
          <>
            <div className={styles['header']}>
              <h1 className="text-h2">{t('forgotPassword.success.title')}</h1>
            </div>
            <Alert tone="success">{t('forgotPassword.success.alert')}</Alert>
          </>
        ) : (
          <>
            <div className={styles['header']}>
              <h1 className="text-h2">{t('forgotPassword.title')}</h1>
              <p className={cx('text-body-sm', 'text-muted', styles['subtitle'])}>
                {t('forgotPassword.subtitle')}
              </p>
            </div>

            {requestReset.isError ? (
              <Alert tone="danger" className={styles['alert']}>
                {t('forgotPassword.errors.unknown')}
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
                type="email"
                label={t('forgotPassword.emailLabel')}
                autoComplete="email"
                error={errors.email?.message}
                disabled={requestReset.isPending}
                {...register('email')}
              />
              <Button type="submit" loading={requestReset.isPending} className={styles['submit']}>
                {requestReset.isPending ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
              </Button>
            </form>
          </>
        )}

        <p className={cx('text-body-sm', styles['footer'])}>
          <Link to="/login">{t('forgotPassword.backToLogin')}</Link>
        </p>
      </Card>
    </div>
  )
}
