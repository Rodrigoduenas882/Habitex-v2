import { useTranslation } from 'react-i18next'
import { useAuthSession } from '@/features/auth/application/useAuthSession'

/**
 * Placeholder route used only to verify the Foundation (providers, router,
 * auth session wiring) works end to end. Not the real dashboard.
 */
export default function HomePage() {
  const { data: session } = useAuthSession()
  const { t } = useTranslation('common')

  return (
    <main>
      <h1>{t('home.title')}</h1>
      <p>{t('home.foundationOk', { session: session?.email ?? session?.userId ?? '' })}</p>
    </main>
  )
}
