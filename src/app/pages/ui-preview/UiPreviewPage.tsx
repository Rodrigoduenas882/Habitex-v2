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

// The `lazy()`/`import()` call itself (not just its later render) must sit
// behind the flag: `import.meta.env['VITE_ENABLE_PROPERTIES_PREVIEW']` is a
// runtime member access on one shared `import.meta.env` object, so it can't
// be constant-folded away and the chunk stays in a normal build even when
// unused. `__ENABLE_PROPERTIES_PREVIEW__` (see vite.config.ts/vite-env.d.ts)
// is a true esbuild `define` literal instead, so this ternary folds to
// `null` and Rollup can prove `import('./PropertiesVisualPreview')`
// unreachable - excluding that chunk (and its fixtures) from `dist/assets`
// entirely, not merely hiding it behind a runtime route check.
const PropertiesVisualPreview = __ENABLE_PROPERTIES_PREVIEW__ ? lazy(() => import('./PropertiesVisualPreview')) : null

// Same mechanism, separate flag (Sprint 3) - see RentalsVisualPreview's own
// doc comment and vite.config.ts's enableRentalsPreview.
const RentalsVisualPreview = __ENABLE_RENTALS_PREVIEW__ ? lazy(() => import('./RentalsVisualPreview')) : null

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
  // so a real `pnpm build` never exposes this route (and never emits its
  // chunk, see the `PropertiesVisualPreview` definition above); only
  // `.env.e2e` (and any future review-only env) sets it.
  if (view === 'properties' && PropertiesVisualPreview) {
    return <Suspense fallback={null}><PropertiesVisualPreview /></Suspense>
  }

  // Same reasoning, Sprint 3: gated behind VITE_ENABLE_RENTALS_PREVIEW.
  if (view === 'rentals' && RentalsVisualPreview) {
    return <Suspense fallback={null}><RentalsVisualPreview /></Suspense>
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
