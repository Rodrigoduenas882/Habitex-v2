import { TrendUpIcon } from '@/shared/ui/icons'
import { REDESIGN_INCOME_SERIES } from './dashboard-redesign-mock-data'
import styles from './FullDashboardIncomeChart.module.css'

function formatCompact(value: number): string {
  return new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/**
 * Decisión de diseño 6 (Evolución de ingresos): mismo criterio "sin librería
 * de gráficos" de FinancialOverview.tsx real (bar chart hecho con `<div>`s
 * posicionados por `%`), reutilizado tal cual en vez de inventar una
 * variación con SVG/línea - mantiene coherencia visual con el Dashboard real
 * que este rediseño eventualmente reemplaza, y evita reimplementar
 * posicionamiento de puntos/curvas para un prototipo 100% visual. 6 meses,
 * income-only (mismo principio que la real: no existe concepto de "gastos"
 * en el schema desplegado).
 *
 * Iteración (Parte 2, 2026-11): ya no usa el `<Card>` compartido (evita
 * pelear especificidad CSS con Card.module.css - ver el comentario de
 * tokens.css sobre --dashboard-redesign-card-surface) - `.panel` replica la
 * misma forma pero lee su superficie de los tokens
 * `--dashboard-redesign-card-*`. Ahora ocupa la columna angosta del grid de
 * analytics en desktop (ver StateFullDashboard.module.css, decisión 2) -
 * el gráfico de barras en sí no cambió de tipo.
 */
export function FullDashboardIncomeChart() {
  const maxValue = Math.max(...REDESIGN_INCOME_SERIES.map((month) => month.income), 1)
  const totalIncome = REDESIGN_INCOME_SERIES.reduce((sum, month) => sum + month.income, 0)

  return (
    <div className={styles['panel']}>
      <div className={styles['header']}>
        <div>
          <h2 className="text-h3">Evolución de ingresos</h2>
          <p className="text-caption">Últimos 6 meses · arriendos cobrados</p>
        </div>
        <TrendUpIcon size={20} className={styles['trendIcon']} />
      </div>

      <div className={styles['summary']}>
        <span className={styles['legendDot']} aria-hidden="true" />
        <span className="text-caption">Total del período</span>
        <span className="text-body tabular-nums" style={{ fontWeight: 600 }}>
          {`$${new Intl.NumberFormat('es-CO').format(totalIncome)}`}
        </span>
      </div>

      <div className={styles['chart']} role="list" aria-label="Evolución de ingresos">
        {REDESIGN_INCOME_SERIES.map((month) => (
          <div
            key={month.label}
            className={styles['month']}
            role="listitem"
            aria-label={`${month.label}: $${new Intl.NumberFormat('es-CO').format(month.income)}`}
          >
            <span className={styles['amount']} aria-hidden="true">
              {formatCompact(month.income)}
            </span>
            <div className={styles['bars']} aria-hidden="true">
              <span className={styles['bar']} style={{ height: `${String((month.income / maxValue) * 100)}%` }} />
            </div>
            <span className="text-caption">{month.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
