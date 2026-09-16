import { useTranslation } from 'react-i18next'

export function LoadingFallback() {
  const { t } = useTranslation('common')

  return (
    <div role="status" aria-live="polite">
      {t('loading')}
    </div>
  )
}
