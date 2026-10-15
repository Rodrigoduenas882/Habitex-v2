import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { cx } from '@/shared/lib/cx'
import { Alert } from '@/shared/ui/Alert'
import { BrandLogo } from '@/shared/ui/BrandLogo'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { useBootstrapAccount } from '../application/useBootstrapAccount'
import styles from './BootstrapAccountPage.module.css'
import {
  BOOTSTRAP_ACCOUNT_FORM_DEFAULTS,
  bootstrapAccountFormSchema,
  toBootstrapAccountInput,
  type BootstrapAccountFormValues,
} from './bootstrap-account-form'

/**
 * The one-time screen between "signed in" and "has an Account" (gated by
 * RedirectIfAccountExists / RequiresAccount). Standalone, no AppShell - the
 * shell's nav has nothing to show yet (no Administration exists until this
 * form submits), same reasoning LoginPage already establishes for
 * authentication-adjacent screens. Mirrors LoginPage's centered-card layout,
 * deliberately without its hero photo/glass (DESIGN.md §10: Login-only).
 */
export default function BootstrapAccountPage() {
  const { t } = useTranslation(['administration', 'common'])
  const navigate = useNavigate()
  const bootstrapAccount = useBootstrapAccount()

  const schema = bootstrapAccountFormSchema(t)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BootstrapAccountFormValues>({
    resolver: zodResolver(schema),
    defaultValues: BOOTSTRAP_ACCOUNT_FORM_DEFAULTS,
  })

  const onSubmit = handleSubmit((values) => {
    bootstrapAccount.mutate(toBootstrapAccountInput(values), {
      onSuccess: () => {
        void navigate('/', { replace: true })
      },
    })
  })

  return (
    <div className={styles['page']}>
      <BrandLogo name={t('common:home.title')} />

      <Card className={styles['card']}>
        <div className={styles['header']}>
          <h1 className="text-h2">{t('bootstrap.title')}</h1>
          <p className={cx('text-body-sm', 'text-muted', styles['subtitle'])}>{t('bootstrap.description')}</p>
        </div>

        {bootstrapAccount.isError ? (
          <Alert tone="danger" className={styles['alert']}>
            {t('bootstrap.errors.submitFailed')}
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
            label={t('bootstrap.fullNameLabel')}
            autoComplete="name"
            error={errors.fullName?.message}
            disabled={bootstrapAccount.isPending}
            {...register('fullName')}
          />
          <Input
            label={t('bootstrap.administrationNameLabel')}
            hint={t('bootstrap.administrationNameHint')}
            disabled={bootstrapAccount.isPending}
            {...register('administrationName')}
          />
          <Button type="submit" loading={bootstrapAccount.isPending} className={styles['submit']}>
            {bootstrapAccount.isPending ? t('bootstrap.submitting') : t('bootstrap.submit')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
