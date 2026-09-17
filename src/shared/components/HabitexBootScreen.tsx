import { useTranslation } from 'react-i18next'
import { BrandMark } from '@/shared/ui/BrandMark'
import styles from './HabitexBootScreen.module.css'

/**
 * The one and only "entering Habitex" screen: BrandMark + three quiet
 * animated dots, nothing else - no "Cargando...", no spinner, no progress
 * bar. Used for:
 *   - the initial route-level Suspense fallback (first JS chunk loading)
 *   - session restore (ProtectedRoute / RedirectIfAuthenticated) while
 *     useAuthSession is still resolving
 *   - hiding the app the instant logout is requested (AuthenticatedLayout)
 *
 * Never used for contextual/in-app loading (forms, buttons, queries) - those
 * keep their own inline loaders. This is purely presentation: it renders
 * only while something it doesn't control is actually pending, and never
 * adds an artificial minimum duration.
 */
export function HabitexBootScreen() {
  const { t } = useTranslation('common')

  return (
    <div className={styles['screen']} role="status" aria-live="polite">
      <BrandMark size={40} aria-label={t('home.title')} />
      <span className={styles['dots']} aria-hidden="true">
        <span className={styles['dot']} data-testid="boot-dot" />
        <span className={styles['dot']} data-testid="boot-dot" />
        <span className={styles['dot']} data-testid="boot-dot" />
      </span>
      <span className="sr-only">{t('loading')}</span>
    </div>
  )
}
