import { Card } from '@/shared/ui/Card'
import { REDESIGN_UPCOMING_OBLIGATIONS } from './dashboard-redesign-mock-data'
import styles from './FullDashboardUpcoming.module.css'

function formatCurrency(value: number): string {
  return `$${new Intl.NumberFormat('es-CO').format(value)}`
}

/** Parsed at local midnight so it never shifts a day depending on the
 * viewer's timezone - same convention as the real DashboardPage's own
 * formatDate. */
function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`),
  )
}

/**
 * Decisión de diseño 3 (Próximas obligaciones y vencimientos): una tabla
 * separada de FullDashboardAttention - "atención" es algo que ya pasó o
 * necesita una acción ahora (pago sin confirmar, cargo vencido, contrato por
 * vencer); "próximas obligaciones" es un cargo (chargeType RENT/
 * ADMINISTRATION) que todavía no vence, puramente informativo. Misma
 * filosofía accesible que AttentionPanel.tsx real: `role="region"` +
 * `aria-label` + `<caption>` visualmente oculta (sr-only) en vez de depender
 * solo de la posición/color para transmitir qué es esta tabla.
 */
export function FullDashboardUpcoming() {
  return (
    <Card className={styles['panel']}>
      <div className={styles['header']}>
        <h2 className="text-h3">Próximas obligaciones</h2>
        <p className="text-caption">Cargos programados que todavía no vencen</p>
      </div>

      <div className={styles['tableWrap']} role="region" aria-label="Próximas obligaciones" tabIndex={0}>
        <table className={styles['table']}>
          <caption className="sr-only">Próximas obligaciones</caption>
          <thead>
            <tr>
              <th scope="col">Vence</th>
              <th scope="col">Descripción</th>
              <th scope="col">Monto</th>
            </tr>
          </thead>
          <tbody>
            {REDESIGN_UPCOMING_OBLIGATIONS.map((obligation) => (
              <tr key={obligation.id}>
                <td className={styles['date']}>{formatDate(obligation.dueDate)}</td>
                <td>{obligation.description}</td>
                <td className={styles['amount']}>{formatCurrency(obligation.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
