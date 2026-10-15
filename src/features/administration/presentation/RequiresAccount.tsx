import { useTranslation } from 'react-i18next'
import { Navigate, Outlet } from 'react-router-dom'
import { HabitexBootScreen } from '@/shared/components/HabitexBootScreen'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { useAccount } from '../application/useAccount'
import styles from './guard-fallback.module.css'

/**
 * Gates every authenticated product route on the current person having an
 * Account - mirrors ProtectedRoute's fail-closed shape, one layer further
 * in (session exists, but does it resolve to an Account?):
 *  - loading -> HabitexBootScreen, same as session bootstrap.
 *  - error -> never falls through to /bootstrap or the product. An unknown
 *    account state is neither "no account yet" nor "has an account" -
 *    assuming either would be wrong, so this shows a minimal retry state
 *    instead (fail closed).
 *  - data === null (no account row yet) -> redirect to /bootstrap.
 *  - data resolved -> render the product (Outlet).
 */
export function RequiresAccount() {
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

  if (account === null) {
    return <Navigate to="/bootstrap" replace />
  }

  return <Outlet />
}
