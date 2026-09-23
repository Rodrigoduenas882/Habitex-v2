import { useTranslation } from 'react-i18next'
import { Navigate, Outlet } from 'react-router-dom'
import { HabitexBootScreen } from '@/shared/components/HabitexBootScreen'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { useAccount } from '../application/useAccount'
import styles from './guard-fallback.module.css'

/**
 * Guards /bootstrap from a person who already has an Account, so it never
 * shows the bootstrap form again (or resubmits it) after the account was
 * created. Same fail-closed shape as RequiresAccount, on purpose - neither
 * guard assumes anything about a loading/error state, they just disagree
 * on what a resolved `null` vs. resolved `Account` means for their route:
 *  - loading -> HabitexBootScreen.
 *  - error -> minimal retry state (fail closed - never assume "no account
 *    yet, let them through" nor "has an account, redirect away").
 *  - data !== null (already has an account) -> redirect to "/".
 *  - data === null (no account yet) -> let them through to the form.
 */
export function RedirectIfAccountExists() {
  const { t } = useTranslation(['administration', 'common'])
  const { data: account, isLoading, isError, refetch } = useAccount()

  if (isLoading) {
    return <HabitexBootScreen />
  }

  if (isError) {
    return (
      <div className={styles['fallback']}>
        <Alert tone="danger" title={t('guardError.title')} className={styles['alert']}>
          {t('guardError.description')}
        </Alert>
        <Button
          onClick={() => {
            void refetch()
          }}
        >
          {t('common:actions.retry')}
        </Button>
      </div>
    )
  }

  if (account !== null) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
