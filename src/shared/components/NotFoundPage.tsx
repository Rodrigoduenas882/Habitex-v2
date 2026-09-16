import { useTranslation } from 'react-i18next'

export default function NotFoundPage() {
  const { t } = useTranslation('common')

  return (
    <main>
      <h1>{t('notFound.title')}</h1>
      <p>{t('notFound.description')}</p>
    </main>
  )
}
