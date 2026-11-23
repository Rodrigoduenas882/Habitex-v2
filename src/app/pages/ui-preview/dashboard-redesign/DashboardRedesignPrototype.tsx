import { Alert } from '@/shared/ui/Alert'
import { AppShellPreview } from '../AppShellPreview'
import { StateSwitcher } from './StateSwitcher'
import styles from './DashboardRedesignPrototype.module.css'

/**
 * Interactive design-only exploration of the Dashboard de Inicio redesign:
 * 3 owner states (Nuevo propietario / Con inmuebles / Dashboard completo),
 * switchable via Tabs. Entirely separate from the real Dashboard
 * (features/dashboard/) - no route, no query, no RPC, no real navigation
 * anywhere in this tree; every value comes from dashboard-redesign-mock-data.ts.
 *
 * Reuses the real AppShellPreview the same way DashboardVisualPreview does
 * (wraps itself here, in fullViewport mode, rather than UiPreviewPage
 * wrapping it) - see DashboardVisualPreview.tsx for the pattern this
 * mirrors.
 */
export default function DashboardRedesignPrototype() {
  return (
    <AppShellPreview fullViewport>
      <div className={styles['page']}>
        <Alert tone="info" title="Prototipo de diseño · Dashboard de Inicio (rediseño)">
          Todo el contenido de esta vista es ficticio. Es una exploración de diseño separada de la app real - nada
          de esto existe todavía en producción ni está conectado a datos reales.
        </Alert>
        <StateSwitcher />
      </div>
    </AppShellPreview>
  )
}
