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
 * `.text-h1`/`.tabular-nums`, mismo lenguaje visual que KpiCard real. La
 * ocupación vive como la 4ª KPI (el %) *y* como un desglose adicional
 * ("4 de 5 unidades ocupadas" + barra) debajo del grid: el % por sí solo no
 * comunica cuántas unidades hay en juego, y el desglose es deliberadamente un
 * Card sólido (NO glass) para no romper la regla de "exclusivo de las 4 KPI
 * cards".
 */
export function FullDashboardKpis() {
  const occupancyPercentage = Math.round(
    (REDESIGN_OCCUPANCY.occupiedUnits / REDESIGN_OCCUPANCY.totalUnits) * 100,
  )

  return (
    <div className={styles['wrapper']}>
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

      <Card className={styles['occupancyBreakdown']}>
        <p className="text-body-sm">
          <strong>{REDESIGN_OCCUPANCY.occupiedUnits}</strong> de <strong>{REDESIGN_OCCUPANCY.totalUnits}</strong>{' '}
          unidades rentables están ocupadas (inmuebles completos, habitaciones habilitadas y parqueaderos).
        </p>
        <div className={styles['bar']} role="img" aria-label={`${String(occupancyPercentage)}% de ocupación`}>
          <div className={styles['barFill']} style={{ width: `${String(occupancyPercentage)}%` }} />
        </div>
      </Card>
    </div>
  )
}
