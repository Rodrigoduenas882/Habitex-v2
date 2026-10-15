import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cx } from '@/shared/lib/cx'
import buttonStyles from '@/shared/ui/Button.module.css'
import { BrandMark } from '@/shared/ui/BrandMark'
import { Card } from '@/shared/ui/Card'
import styles from './NotFoundPage.module.css'

/**
 * The 404 catch-all route - reachable by both authenticated and
 * unauthenticated visitors (mounted directly under RootLayout, outside
 * ProtectedRoute/RequiresAccount/AuthenticatedLayout), so it never assumes a
 * session or an Account exists. The only way out is "/" - never
 * history.back(), since a 404 can be reached with no real browser history
 * (direct link, bookmark). "/" always resolves correctly regardless of
 * session state via the existing routing guards.
 */
export default function NotFoundPage() {
  const { t } = useTranslation('common')

  return (
    <main className={styles['screen']}>
      <BrandMark size={40} aria-label={t('home.title')} />
      <Card className={styles['card']}>
        <h1 className="text-h2">{t('notFound.title')}</h1>
        <p className={cx('text-body', 'text-muted')}>{t('notFound.description')}</p>
        <Link
          to="/"
          className={cx(buttonStyles['button'], buttonStyles['primary'], buttonStyles['md'])}
        >
          {t('notFound.backHome')}
        </Link>
      </Card>
    </main>
  )
}
