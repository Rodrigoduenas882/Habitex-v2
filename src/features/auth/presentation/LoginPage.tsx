import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { cx } from '@/shared/lib/cx'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { FileTextIcon, HomeIcon, KeyIcon, WalletIcon } from '@/shared/ui/icons'
import { Input } from '@/shared/ui/Input'
import { useLogin } from '../application/useLogin'
import styles from './LoginPage.module.css'

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
      <aside className={styles['brandPanel']} aria-hidden="true">
        <div className={styles['brandMarkRow']}>
          <span className={styles['brandMark']} />
          <span className={styles['brandName']}>{t('common:home.title')}</span>
        </div>

        <div className={styles['flow']}>
          <span className={cx(styles['flowNode'], styles['flowNode1'])}>
            <HomeIcon size={20} />
          </span>
          <span className={styles['flowConnector']} />
          <span className={cx(styles['flowNode'], styles['flowNode2'])}>
            <KeyIcon size={20} />
          </span>
          <span className={styles['flowConnector']} />
          <span className={cx(styles['flowNode'], styles['flowNode3'])}>
            <WalletIcon size={20} />
          </span>
          <span className={styles['flowConnector']} />
          <span className={cx(styles['flowNode'], styles['flowNode4'])}>
            <FileTextIcon size={20} />
          </span>
        </div>

        <div className={styles['brandCopy']}>
          <p className={styles['headline']}>
            {t('login.brandHeadlineLine1')}
            <br />
            {t('login.brandHeadlineLine2')}
          </p>
          <p className={cx('text-body', styles['tagline'])}>{t('login.brandCopy')}</p>
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
