import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { z } from 'zod'
import { cx } from '@/shared/lib/cx'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { useLogin } from '../application/useLogin'
import { AuthPageLayout } from './AuthPageLayout'
import styles from './LoginPage.module.css'

/**
 * The official Habitex login: a theme-reactive property photo (day/night
 * crossfade) with a compact metrics preview, next to a simple email/password
 * form. Approved after a side-by-side comparison against an earlier
 * split-screen concept (kept briefly as LoginPreviewPage, now removed).
 * The hero itself now lives in AuthPageLayout/AuthHeroPanel, shared with
 * every other public auth screen (DESIGN.md §10, amended) - this page only
 * supplies the glass stats-card preview as `heroContent`, which stays
 * Login-exclusive (glassmorphism itself is still Login-only).
 *
 * `location.state.passwordUpdated` is the one-time flag ResetPasswordPage's
 * navigate() sets after a successful password change (see that page's own
 * doc comment) - read directly off history state rather than a query
 * param/persisted flag, so it naturally disappears on any subsequent
 * navigation instead of needing explicit cleanup.
 */
export default function LoginPage() {
  const { t } = useTranslation(['auth', 'common'])
  const location = useLocation()
  const login = useLogin()
  const passwordUpdated = (location.state as { passwordUpdated?: boolean } | null)?.passwordUpdated === true

  const schema = z.object({
    email: z
      .string()
      .min(1, t('login.validation.emailRequired'))
      .pipe(z.email(t('login.validation.emailInvalid'))),
    password: z.string().min(1, t('login.validation.passwordRequired')),
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

  const heroHeadline = (
    <>
      {t('authHero.headlineLine1')}
      <br />
      {t('authHero.headlineLine2')}
    </>
  )

  const statsCard = (
    <div className={styles['statsCard']}>
      <p className={cx('text-label', styles['statsTitle'])}>{t('authHero.statsTitle')}</p>
      <div className={styles['statsGrid']}>
        <div className={styles['statItem']}>
          <p className={cx('text-caption', styles['statLabel'])}>{t('authHero.incomeLabel')}</p>
          <p className={cx('text-h3', 'tabular-nums', styles['statValue'])}>{t('authHero.incomeValue')}</p>
          <p className={styles['statTrend']}>{t('authHero.incomeTrend')}</p>
        </div>
        <div className={cx(styles['statItem'], styles['statItemDivider'])}>
          <p className={cx('text-h3', 'tabular-nums', styles['statValue'])}>{t('authHero.propertiesValue')}</p>
          <p className={cx('text-caption', styles['statLabel'])}>{t('authHero.propertiesLabel')}</p>
        </div>
        <div className={cx(styles['statItem'], styles['statItemDivider'])}>
          <p className={cx('text-h3', 'tabular-nums', styles['statValue'])}>{t('authHero.occupancyValue')}</p>
          <p className={cx('text-caption', styles['statLabel'])}>{t('authHero.occupancyLabel')}</p>
        </div>
      </div>
    </div>
  )

  return (
    <AuthPageLayout heroHeadline={heroHeadline} heroTagline={t('authHero.tagline')} heroContent={statsCard}>
      <Card className={styles['card']}>
        <div className={styles['header']}>
          <h1 className="text-h2">{t('login.title')}</h1>
          <p className={cx('text-body-sm', 'text-muted', styles['subtitle'])}>
            {t('login.subtitle')}
          </p>
        </div>

        {passwordUpdated && !login.isError ? (
          <Alert tone="success" className={styles['alert']}>
            {t('login.passwordUpdated')}
          </Alert>
        ) : null}

        {login.isError ? (
          <Alert tone="danger" className={styles['alert']}>
            {/* signInWithPassword can only ever produce invalid_credentials
                or unknown (see session.types.ts's AuthErrorCode doc
                comment: weak_password/same_password/session_expired are
                updatePassword-only) - an explicit check rather than a
                dynamic `errors.${code}` key, so this stays correct without
                needing a login.errors entry for codes this call can never
                produce. */}
            {t(login.error.code === 'invalid_credentials' ? 'login.errors.invalid_credentials' : 'login.errors.unknown')}
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
            label={t('login.emailLabel')}
            autoComplete="email"
            error={errors.email?.message}
            disabled={login.isPending}
            {...register('email')}
          />
          <Input
            type="password"
            label={t('login.passwordLabel')}
            autoComplete="current-password"
            error={errors.password?.message}
            disabled={login.isPending}
            {...register('password')}
          />
          <p className={cx('text-body-sm', styles['forgotPasswordLink'])}>
            <Link to="/forgot-password">{t('login.forgotPasswordLink')}</Link>
          </p>
          <Button type="submit" loading={login.isPending} className={styles['submit']}>
            {login.isPending ? t('login.submitting') : t('login.submit')}
          </Button>
        </form>

        <p className={cx('text-body-sm', styles['footer'])}>
          {t('login.signupPrompt')} <Link to="/signup">{t('login.signupLink')}</Link>
        </p>
      </Card>
    </AuthPageLayout>
  )
}
