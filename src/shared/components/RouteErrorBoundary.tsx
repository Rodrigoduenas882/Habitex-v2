import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function RouteErrorBoundary() {
  const error = useRouteError()
  const { t } = useTranslation('common')

  // HTTP status/statusText are technical values from React Router, not UI copy - not translated.
  const message = isRouteErrorResponse(error)
    ? `${String(error.status)} ${error.statusText}`
    : t('error.unexpected')

  return (
    <main role="alert">
      <h1>{t('error.title')}</h1>
      <p>{message}</p>
    </main>
  )
}
