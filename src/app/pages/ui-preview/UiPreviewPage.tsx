import { lazy, Suspense } from 'react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ThemeControl } from '@/shared/theme/ThemeControl'
import { AlertsSection } from './AlertsSection'
import { AppShellSection } from './AppShellSection'
import { BrandSection } from './BrandSection'
import { ButtonsSection } from './ButtonsSection'
import { CardsSection } from './CardsSection'
import { ColorsSection } from './ColorsSection'
import { EmptyStateSection } from './EmptyStateSection'
import { FormControlsSection } from './FormControlsSection'
import { SkeletonSection } from './SkeletonSection'
import { StatusBadgesSection } from './StatusBadgesSection'
import { TypographySection } from './TypographySection'
import styles from './UiPreviewPage.module.css'

const DashboardVisualPreview = lazy(() => import('./DashboardVisualPreview'))
const PropertiesVisualPreview = lazy(() => import('./PropertiesVisualPreview'))

/**
 * Internal design-system evaluation tool. Public on purpose (see router.tsx):
 * it exists to review the visual language, not to expose product data, and
 * every value on this route is a local mock (see mock-data.ts).
 */
export default function UiPreviewPage() {
  const { t } = useTranslation('uiPreview')

  useEffect(() => {
    document.title = t('meta.title')
  }, [t])

  const view = new URLSearchParams(window.location.search).get('view')

  if (import.meta.env.DEV && view === 'dashboard') {
    return <Suspense fallback={null}><DashboardVisualPreview /></Suspense>
  }

  // Gated behind an explicit build flag (not `import.meta.env.DEV`, which
  // would also disable it for Playwright's production-style build) - see
  // PropertiesVisualPreview's own doc comment. Unset in `.env`/.env.example,
  // so a real `pnpm build` never exposes this route; only `.env.e2e` (and
  // any future review-only env) sets it.
  if (view === 'properties' && import.meta.env['VITE_ENABLE_PROPERTIES_PREVIEW'] === 'true') {
    return <Suspense fallback={null}><PropertiesVisualPreview /></Suspense>
  }

  return (
    <div className={styles['page']}>
      <header className={styles['header']}>
        <p className="text-label">{t('meta.title')}</p>
        <ThemeControl />
      </header>

      <div className={styles['container']}>
        <BrandSection />
        <ColorsSection />
        <TypographySection />
        <ButtonsSection />
        <FormControlsSection />
        <StatusBadgesSection />
        <CardsSection />
        <AlertsSection />
        <EmptyStateSection />
        <SkeletonSection />
        <AppShellSection />
      </div>
    </div>
  )
}
