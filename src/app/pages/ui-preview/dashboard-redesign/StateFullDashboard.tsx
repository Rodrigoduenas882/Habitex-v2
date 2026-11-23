import { cx } from '@/shared/lib/cx'
import { REDESIGN_OWNER_NAME } from './dashboard-redesign-mock-data'
import { FullDashboardAttention } from './FullDashboardAttention'
import { FullDashboardIncomeChart } from './FullDashboardIncomeChart'
import { FullDashboardKpis } from './FullDashboardKpis'
import { FullDashboardQuickActions } from './FullDashboardQuickActions'
import { FullDashboardUpcoming } from './FullDashboardUpcoming'
import styles from './StateFullDashboard.module.css'

/**
 * Estado C - propietario con arriendos activos ("dashboard completo"). Same
 * overall section order/vocabulary as the real Dashboard
 * (features/dashboard/presentation/DashboardPage.tsx: header, 4 KPI cards,
 * quick actions, a two-column analytics row, then a dedicated section) but
 * rebuilt from scratch for this prototype - no import from features/
 * dashboard/ anywhere in this tree. Every fixture used here comes from
 * dashboard-redesign-mock-data.ts and is 100% fictitious (see
 * DashboardRedesignPrototype's own Alert).
 *
 * Section order and the "why" behind each one (see this part's own task
 * brief for the full breakdown):
 * 1. FullDashboardKpis - resumen financiero (4 KPI cards, único lugar que usa
 *    --dashboard-redesign-kpi-glass-surface) + resumen de ocupación.
 * 2. FullDashboardQuickActions - accesos rápidos contextuales.
 * 3. FullDashboardAttention + FullDashboardIncomeChart - atención (algo que
 *    ya pasó o necesita acción ahora) y evolución de ingresos, lado a lado en
 *    desktop igual que la pareja AttentionPanel/FinancialOverview real.
 * 4. FullDashboardUpcoming - próximas obligaciones (algo programado a
 *    futuro), deliberadamente su propia sección para no mezclarse con 3.
 */
export function StateFullDashboard() {
  return (
    <div className={styles['wrapper']}>
      <header className={styles['header']}>
        <p className={cx('text-caption', styles['eyebrow'])}>Hola, {REDESIGN_OWNER_NAME}</p>
        <h1 className="text-h1">Tu dashboard</h1>
        <p className={cx('text-body', 'text-muted')}>
          Tienes arriendos activos. Este es el resumen de tu operación este mes.
        </p>
      </header>

      <FullDashboardKpis />

      <FullDashboardQuickActions />

      <div className={styles['analytics']}>
        <FullDashboardAttention />
        <FullDashboardIncomeChart />
      </div>

      <FullDashboardUpcoming />
    </div>
  )
}
