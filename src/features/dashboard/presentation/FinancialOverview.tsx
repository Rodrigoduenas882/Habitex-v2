import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { Card } from '@/shared/ui/Card'
import styles from './FinancialOverview.module.css'
import type { FinancialMonth } from './dashboard-mock-data'

export interface FinancialOverviewProps {
  months: readonly FinancialMonth[]
}

const formatCurrency = (value: number) => `$${new Intl.NumberFormat('es-CO').format(value)}`

/**
 * Lightweight CSS-only bar comparison - no charting library for this
 * iteration. Bar heights are data-driven (inline style), everything else
 * (color, radius, spacing) comes from tokens.
 */
export function FinancialOverview({ months }: FinancialOverviewProps) {
  const { t } = useTranslation('dashboard')
  const maxValue = Math.max(...months.flatMap((month) => [month.income, month.expenses]), 1)
  const totalIncome = months.reduce((sum, month) => sum + month.income, 0)
  const totalExpenses = months.reduce((sum, month) => sum + month.expenses, 0)

  return (
    <Card>
      <div className={styles['header']}>
        <div>
          <h2 className="text-h3">{t('financialOverview.title')}</h2>
          <p className="text-caption">{t('financialOverview.subtitle')}</p>
        </div>
      </div>

      <div className={styles['summary']}>
        <div className={styles['summaryItem']}>
          <span className={cx(styles['legendDot'], styles['legendDotIncome'])} aria-hidden="true" />
          <span className="text-caption">{t('financialOverview.income')}</span>
          <span className={cx('text-body', 'tabular-nums', styles['summaryValue'])}>
            {formatCurrency(totalIncome)}
          </span>
        </div>
        <div className={styles['summaryItem']}>
          <span className={cx(styles['legendDot'], styles['legendDotExpenses'])} aria-hidden="true" />
          <span className="text-caption">{t('financialOverview.expenses')}</span>
          <span className={cx('text-body', 'tabular-nums', styles['summaryValue'])}>
            {formatCurrency(totalExpenses)}
          </span>
        </div>
      </div>

      <div className={styles['chart']}>
        {months.map((month) => (
          <div key={month.label} className={styles['month']}>
            <div className={styles['bars']}>
              <span
                className={cx(styles['bar'], styles['barIncome'])}
                style={{ height: `${String((month.income / maxValue) * 100)}%` }}
              />
              <span
                className={cx(styles['bar'], styles['barExpenses'])}
                style={{ height: `${String((month.expenses / maxValue) * 100)}%` }}
              />
            </div>
            <span className={cx('text-caption', styles['monthLabel'])}>{month.label}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
