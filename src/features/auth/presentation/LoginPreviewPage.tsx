import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { cx } from '@/shared/lib/cx'
import { ThemeControl } from '@/shared/theme/ThemeControl'
import { Alert } from '@/shared/ui/Alert'
import { BrandLogo } from '@/shared/ui/BrandLogo'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { useLogin } from '../application/useLogin'
import styles from './LoginPreviewPage.module.css'

/**
 * Visual-only exploration of a new Login direction - NOT the real /login
 * yet, and not linked to from anywhere in the app. Reuses the exact same
 * Auth wiring as LoginPage (useLogin, the same validation rules) so the
 * comparison is apples-to-apples; only the presentation differs. Keep both
 * pages side by side until one is chosen; then this one either replaces
 * LoginPage.tsx or gets deleted along with its own i18n keys/route.
 */
export default function LoginPreviewPage() {
  const { t } = useTranslation(['auth', 'common'])
  const login = useLogin()

  const schema = z.object({
    email: z
      .string()
      .min(1, t('loginPreview.validation.emailRequired'))
      .pipe(z.email(t('loginPreview.validation.emailInvalid'))),
    password: z.string().min(1, t('loginPreview.validation.passwordRequired')),
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
    <div className={styles['page']}>
      <aside className={styles['heroPanel']}>
        <div className={styles['heroPhoto']} aria-hidden="true">
          <div className={cx(styles['heroPhotoLayer'], styles['heroPhotoDay'])} />
          <div className={cx(styles['heroPhotoLayer'], styles['heroPhotoNight'])} />
          <div className={styles['heroScrim']} />
        </div>

        <div className={styles['heroContent']}>
          <div className={styles['heroTop']}>
            <div className={styles['brandMarkRow']}>
              <BrandLogo name={t('common:home.title')} />
            </div>
            <ThemeControl />
          </div>

          <div className={styles['heroBottom']}>
            <div className={styles['heroCopy']}>
              <p className={styles['heroHeadline']}>
                {t('loginPreview.hero.headlineLine1')}
                <br />
                {t('loginPreview.hero.headlineLine2')}
              </p>
              <p className={cx('text-body', styles['heroTagline'])}>
                {t('loginPreview.hero.tagline')}
              </p>
            </div>

            <div className={styles['statsCard']}>
              <p className={cx('text-label', styles['statsTitle'])}>
                {t('loginPreview.hero.statsTitle')}
              </p>
              <div className={styles['statsGrid']}>
                <div className={styles['statItem']}>
                  <p className={cx('text-caption', styles['statLabel'])}>
                    {t('loginPreview.hero.incomeLabel')}
                  </p>
                  <p className={cx('text-h3', 'tabular-nums', styles['statValue'])}>
                    {t('loginPreview.hero.incomeValue')}
                  </p>
                  <p className={styles['statTrend']}>{t('loginPreview.hero.incomeTrend')}</p>
                </div>
                <div className={cx(styles['statItem'], styles['statItemDivider'])}>
                  <p className={cx('text-h3', 'tabular-nums', styles['statValue'])}>
                    {t('loginPreview.hero.propertiesValue')}
                  </p>
                  <p className={cx('text-caption', styles['statLabel'])}>
                    {t('loginPreview.hero.propertiesLabel')}
                  </p>
                </div>
                <div className={cx(styles['statItem'], styles['statItemDivider'])}>
                  <p className={cx('text-h3', 'tabular-nums', styles['statValue'])}>
                    {t('loginPreview.hero.occupancyValue')}
                  </p>
                  <p className={cx('text-caption', styles['statLabel'])}>
                    {t('loginPreview.hero.occupancyLabel')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className={styles['formPanel']}>
        <Card className={styles['card']}>
          <div className={styles['header']}>
            <h1 className="text-h2">{t('loginPreview.title')}</h1>
            <p className={cx('text-body-sm', 'text-muted', styles['subtitle'])}>
              {t('loginPreview.subtitle')}
            </p>
          </div>

          {login.isError ? (
            <Alert tone="danger" className={styles['alert']}>
              {t(`loginPreview.errors.${login.error.code}`)}
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
              label={t('loginPreview.emailLabel')}
              autoComplete="email"
              error={errors.email?.message}
              disabled={login.isPending}
              {...register('email')}
            />
            <Input
              type="password"
              label={t('loginPreview.passwordLabel')}
              autoComplete="current-password"
              error={errors.password?.message}
              disabled={login.isPending}
              {...register('password')}
            />
            <Button type="submit" loading={login.isPending} className={styles['submit']}>
              {login.isPending ? t('loginPreview.submitting') : t('loginPreview.submit')}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  )
}
