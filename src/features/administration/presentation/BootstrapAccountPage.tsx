import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
// Cross-feature import, same precedent InvitationClaimPage's own doc
// comment already establishes (DashboardPage/AuthenticatedLayout also
// import features/auth/application/* directly): session state is a
// cross-cutting concern, not something this feature re-implements.
import { useAuthSession } from '@/features/auth/application/useAuthSession'
import { HabitexBootScreen } from '@/shared/components/HabitexBootScreen'
import { cx } from '@/shared/lib/cx'
import { Alert } from '@/shared/ui/Alert'
import { BrandLogo } from '@/shared/ui/BrandLogo'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { useBootstrapAccount } from '../application/useBootstrapAccount'
import styles from './BootstrapAccountPage.module.css'
import {
  bootstrapAccountFormDefaults,
  bootstrapAccountFormSchema,
  toBootstrapAccountInput,
  type BootstrapAccountFormValues,
} from './bootstrap-account-form'

/**
 * The one-time step between "signed in" and "has an Account" (gated by
 * RedirectIfAccountExists / RequiresAccount). Standalone, no AppShell - the
 * shell's nav has nothing to show yet (no Administration exists until
 * bootstrap_account runs), same reasoning LoginPage already establishes for
 * authentication-adjacent screens. Mirrors LoginPage's centered-card layout,
 * deliberately without its hero photo/glass (DESIGN.md §10: Login-only).
 *
 * A self-registering owner (fullName already captured at /signup, see
 * SignUpPage) never sees this screen's form: BootstrapAccountForm
 * auto-submits bootstrap_account with that name and the backend's own
 * default Administration name the moment it mounts, showing
 * HabitexBootScreen instead - landing on Inicio reads as one continuous
 * "finishing sign-in" moment, not a second registration step right after
 * the first. The form only ever appears for the two cases that genuinely
 * need a person's input: no name in metadata at all (an older account, or
 * any future auth path that never collects one), or the automatic attempt
 * itself failing (network/RPC error) - both fall back to the exact same
 * editable, pre-filled form this screen always had, including its own
 * error alert and retry-by-resubmit. Safe to retry/duplicate-fire (a stray
 * reload mid-attempt, StrictMode's dev-only double effect invocation):
 * bootstrap_account is idempotent on the backend (AccountRepository's own
 * doc comment) - a second call for an auth user that already has an
 * Account creates nothing and just returns it.
 *
 * Split into an outer gate + inner form deliberately: useForm's
 * defaultValues is captured exactly once, at this component's first
 * mount/render, and never updates again even if the prop it was computed
 * from changes later (a well-known React Hook Form behavior, not a bug) -
 * so BootstrapAccountForm must not even be mounted until the session has
 * actually resolved, or fullName's pre-fill would silently capture an
 * empty default and never recover. In the real app this never shows a
 * visible boot-screen flicker (ProtectedRoute/RedirectIfAccountExists above
 * this route already resolved the exact same query, so it's served from
 * cache synchronously) - it only matters for a cold cache (e.g. this page
 * mounted in isolation, as its own tests do).
 */
export default function BootstrapAccountPage() {
  const authSession = useAuthSession()

  if (authSession.isLoading) {
    return <HabitexBootScreen />
  }

  return <BootstrapAccountForm fullNameFromMetadata={authSession.data?.fullNameFromMetadata} />
}

interface BootstrapAccountFormProps {
  fullNameFromMetadata: string | null | undefined
}

function BootstrapAccountForm({ fullNameFromMetadata }: BootstrapAccountFormProps) {
  const { t } = useTranslation(['administration', 'common'])
  const navigate = useNavigate()
  const bootstrapAccount = useBootstrapAccount()

  const trimmedMetadataName = fullNameFromMetadata?.trim() ?? ''
  // Starts true only when /signup already captured a name - computed once,
  // same "captured at first render" rule as useForm's defaultValues below.
  // Only ever flips true -> false (on the automatic attempt's own error),
  // never back, so the effect below can never re-fire a second real
  // mutate() for the same mount.
  const [autoProvisioning, setAutoProvisioning] = useState(() => trimmedMetadataName.length > 0)

  useEffect(() => {
    if (!autoProvisioning) {
      return
    }

    bootstrapAccount.mutate(
      { fullName: trimmedMetadataName },
      {
        onSuccess: () => {
          void navigate('/', { replace: true })
        },
        onError: () => {
          setAutoProvisioning(false)
        },
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per mount, guarded by autoProvisioning itself (see comment above); bootstrapAccount/navigate/trimmedMetadataName are stable for the component's lifetime.
  }, [autoProvisioning])

  // useForm (and every other hook) must still run on every render, even the
  // auto-provisioning ones where its output goes unused below - skipping it
  // conditionally would change the number of hooks called once
  // autoProvisioning flips to false later in this same mounted instance,
  // violating the Rules of Hooks.
  const schema = bootstrapAccountFormSchema(t)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BootstrapAccountFormValues>({
    resolver: zodResolver(schema),
    defaultValues: bootstrapAccountFormDefaults(fullNameFromMetadata),
  })

  const onSubmit = handleSubmit((values) => {
    bootstrapAccount.mutate(toBootstrapAccountInput(values), {
      onSuccess: () => {
        void navigate('/', { replace: true })
      },
    })
  })

  if (autoProvisioning) {
    return <HabitexBootScreen />
  }

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
