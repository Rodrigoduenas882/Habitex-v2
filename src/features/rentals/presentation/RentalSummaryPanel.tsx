import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { Card } from '@/shared/ui/Card'
import styles from './RentalSummaryPanel.module.css'

export interface RentalSummaryPanelProps {
  subjectLabel: string | null
  tenantName: string | null
  rentAmount: number | null
  startDate: string | null
  endDate: string | null
}

/** Same plain-date parsing as RentalListCard's own formatDate - stored
 * values are dates with no time/zone, parsed at local midnight so they never
 * shift a day depending on the viewer's timezone. */
function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`),
  )
}

/** Same COP-only formatting as RentalListCard's own formatAmount. */
function formatAmount(value: number): string {
  return `$${new Intl.NumberFormat('es-CO').format(value)}`
}

/**
 * Persistent "resumen del arriendo" shown alongside the creation/condiciones/
 * contrato steps (docs/DESIGN.md §16.6 - Figma `Habitex-Design-Lab`
 * 370:3/370:477/370:716). Read-only, never a form: every value is whatever
 * the host page already resolved (a real subject/tenant/term-version value,
 * or a live react-hook-form watch value while a form is being filled) -
 * this component never fetches anything itself and never fabricates a
 * value. A field that isn't resolved yet shows the honest, translated
 * "Sin definir" placeholder, same convention as RentalListCard's own
 * subjectUnknown/tenantUnknown/rentAmountUnknown fallbacks.
 */
export function RentalSummaryPanel({ subjectLabel, tenantName, rentAmount, startDate, endDate }: RentalSummaryPanelProps) {
  const { t } = useTranslation('rentals')

  const dates =
    startDate && endDate
      ? t('summary.dateRange', { start: formatDate(startDate), end: formatDate(endDate) })
      : startDate
        ? t('summary.dateFrom', { date: formatDate(startDate) })
        : null

  return (
    <Card className={styles['panel']} role="region" aria-label={t('summary.title')}>
      <p className="text-h3">{t('summary.title')}</p>

      <div className={styles['row']}>
        <span className={styles['rowLabel']}>{t('summary.subjectLabel')}</span>
        <span className={cx(styles['rowValue'], subjectLabel === null && styles['rowValueMuted'])}>
          {subjectLabel ?? t('summary.undefined')}
        </span>
      </div>

      <div className={styles['row']}>
        <span className={styles['rowLabel']}>{t('summary.tenant')}</span>
        <span className={cx(styles['rowValue'], tenantName === null && styles['rowValueMuted'])}>
          {tenantName ?? t('summary.undefined')}
        </span>
      </div>

      <div className={styles['row']}>
        <span className={styles['rowLabel']}>{t('summary.rentAmount')}</span>
        <span className={cx(styles['rowValue'], 'tabular-nums', rentAmount === null && styles['rowValueMuted'])}>
          {rentAmount !== null ? formatAmount(rentAmount) : t('summary.undefined')}
        </span>
      </div>

      <div className={styles['row']}>
        <span className={styles['rowLabel']}>{t('summary.dates')}</span>
        <span className={cx(styles['rowValue'], dates === null && styles['rowValueMuted'])}>
          {dates ?? t('summary.undefined')}
        </span>
      </div>
    </Card>
  )
}
