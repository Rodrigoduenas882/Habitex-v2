import { RouterProvider } from 'react-router-dom'
import '@/infrastructure/i18n/i18n'
import { AppProviders } from '../providers/AppProviders'
import { router } from '../router/router'

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
