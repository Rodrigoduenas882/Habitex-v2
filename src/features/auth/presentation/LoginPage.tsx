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
import styles from './LoginPage.module.css'

/**
 * The official Habitex login: a theme-reactive property photo (day/night
 * crossfade) with a compact metrics preview, next to a simple email/password
 * form. Approved after a side-by-side comparison against an earlier
 * split-screen concept (kept briefly as LoginPreviewPage, now removed).
 */
export default function LoginPage() {
  const { t } = useTranslation(['auth', 'common'])
  const login = useLogin()

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
                {t('login.hero.headlineLine1')}
                <br />
                {t('login.hero.headlineLine2')}
              </p>
              <p className={cx('text-body', styles['heroTagline'])}>{t('login.hero.tagline')}</p>
            </div>

            <div className={styles['statsCard']}>
              <p className={cx('text-label', styles['statsTitle'])}>
                {t('login.hero.statsTitle')}
              </p>
              <div className={styles['statsGrid']}>
                <div className={styles['statItem']}>
                  <p className={cx('text-caption', styles['statLabel'])}>
                    {t('login.hero.incomeLabel')}
                  </p>
                  <p className={cx('text-h3', 'tabular-nums', styles['statValue'])}>
                    {t('login.hero.incomeValue')}
                  </p>
                  <p className={styles['statTrend']}>{t('login.hero.incomeTrend')}</p>
                </div>
                <div className={cx(styles['statItem'], styles['statItemDivider'])}>
                  <p className={cx('text-h3', 'tabular-nums', styles['statValue'])}>
                    {t('login.hero.propertiesValue')}
                  </p>
                  <p className={cx('text-caption', styles['statLabel'])}>
                    {t('login.hero.propertiesLabel')}
                  </p>
                </div>
                <div className={cx(styles['statItem'], styles['statItemDivider'])}>
                  <p className={cx('text-h3', 'tabular-nums', styles['statValue'])}>
                    {t('login.hero.occupancyValue')}
                  </p>
                  <p className={cx('text-caption', styles['statLabel'])}>
                    {t('login.hero.occupancyLabel')}
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
            <h1 className="text-h2">{t('login.title')}</h1>
            <p className={cx('text-body-sm', 'text-muted', styles['subtitle'])}>
              {t('login.subtitle')}
            </p>
          </div>

          {login.isError ? (
            <Alert tone="danger" className={styles['alert']}>
              {t(`login.errors.${login.error.code}`)}
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
            <Button type="submit" loading={login.isPending} className={styles['submit']}>
              {login.isPending ? t('login.submitting') : t('login.submit')}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  )
}
