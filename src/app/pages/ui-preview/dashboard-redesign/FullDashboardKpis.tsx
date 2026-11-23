import { Card } from '@/shared/ui/Card'
import { IconBadge } from '@/shared/ui/IconBadge'
import { AlertTriangleIcon, UsersIcon, WalletIcon } from '@/shared/ui/icons'
import {
  REDESIGN_FINANCIAL_SUMMARY,
  REDESIGN_OCCUPANCY,
} from './dashboard-redesign-mock-data'
import styles from './FullDashboardKpis.module.css'

function formatCurrency(value: number): string {
  return `$${new Intl.NumberFormat('es-CO').format(value)}`
}

/**
 * Decisión de diseño 1 (Resumen financiero) + 4 (Resumen de ocupación):
 * exactamente 4 KPI cards usan `--dashboard-glass-surface` (DESIGN.md §14,
 * exclusivo de estas 4 tarjetas) - Cobrado/success, Pendiente/warning,
 * Vencido/danger, Ocupación/info - cada una con IconBadge + valor en
 * `.text-h1`/`.tabular-nums`, mismo lenguaje visual que KpiCard real. Estas 4
 * siguen usando el `<Card>` compartido + `--dashboard-glass-surface` sin
 * tocar (DESIGN.md §14 reserva ese vidrio exclusivamente a estas 4 tarjetas)
 * - son la única excepción a la migración a los tokens
 * `--dashboard-redesign-card-*` del resto de este prototipo.
 *
 * Iteración (Parte 2, 2026-11), decisión 2: el panel de desglose de
 * ocupación ("4 de 5 unidades... ocupadas" + barra de progreso) que vivía
 * debajo de este grid se eliminó - era puramente redundante con la 4ª KPI
 * de arriba (mismo número, "Ocupación 80%" + "4 de 5 unidades ocupadas" ya
 * está ahí), y la barra no comunicaba nada que el % en `.text-h1` no
 * comunicara ya. La única información distinta que tenía el desglose (la
 * enumeración de qué cuenta como "unidad": inmuebles completos, habitaciones
 * habilitadas, parqueaderos) no justificaba un panel de ancho completo
 * aparte.
 */
export function FullDashboardKpis() {
  const occupancyPercentage = Math.round(
    (REDESIGN_OCCUPANCY.occupiedUnits / REDESIGN_OCCUPANCY.totalUnits) * 100,
  )

  return (
    <div className={styles['grid']}>
      <Card className={styles['card']}>
        <div className={styles['top']}>
          <p className="text-caption">Cobrado este mes</p>
          <IconBadge icon={<WalletIcon size={18} />} tone="success" size={30} radius="md" />
        </div>
        <div className="text-h1 tabular-nums">{formatCurrency(REDESIGN_FINANCIAL_SUMMARY.collectedAmount)}</div>
        <p className="text-caption text-muted">Arriendos (RENT) ya confirmados</p>
      </Card>

      <Card className={styles['card']}>
        <div className={styles['top']}>
          <p className="text-caption">Pendiente por cobrar</p>
          <IconBadge icon={<AlertTriangleIcon size={18} />} tone="warning" size={30} radius="md" />
        </div>
        <div className="text-h1 tabular-nums">{formatCurrency(REDESIGN_FINANCIAL_SUMMARY.pendingAmount)}</div>
        <p className="text-caption text-muted">Cargos del mes sin pago completo</p>
      </Card>

      <Card className={styles['card']}>
        <div className={styles['top']}>
          <p className="text-caption">Vencido</p>
          <IconBadge icon={<AlertTriangleIcon size={18} />} tone="danger" size={30} radius="md" />
        </div>
        <div className="text-h1 tabular-nums">{formatCurrency(REDESIGN_FINANCIAL_SUMMARY.overdueAmount)}</div>
        <p className="text-caption text-muted">Cargos vencidos sin pagar</p>
      </Card>

      <Card className={styles['card']}>
        <div className={styles['top']}>
          <p className="text-caption">Ocupación</p>
          <IconBadge icon={<UsersIcon size={18} />} tone="info" size={30} radius="md" />
        </div>
        <div className="text-h1 tabular-nums">{occupancyPercentage}%</div>
        <p className="text-caption text-muted">
          {REDESIGN_OCCUPANCY.occupiedUnits} de {REDESIGN_OCCUPANCY.totalUnits} unidades ocupadas
        </p>
      </Card>
    </div>
  )
}
