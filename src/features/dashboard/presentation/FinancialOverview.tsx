import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { EmptyState } from '@/shared/ui/EmptyState'
import { WalletIcon } from '@/shared/ui/icons'
import { Card } from '@/shared/ui/Card'
import styles from './FinancialOverview.module.css'
import type { DashboardFinancialMonth } from '../application/useDashboardFinancials'

export interface FinancialOverviewProps {
  months: readonly DashboardFinancialMonth[]
}

const formatCurrency = (value: number) => `$${new Intl.NumberFormat('es-CO').format(value)}`

/**
 * Lightweight CSS-only bar chart - no charting library for this iteration.
 * Bar heights are data-driven (inline style), everything else (color,
 * radius, spacing) comes from tokens. Income-only: there is no "expenses"
 * concept anywhere in the deployed schema (see useDashboardFinancials' own
 * doc comment), so this no longer renders a second bar/legend/total.
 */
export function FinancialOverview({ months }: FinancialOverviewProps) {
  const { t } = useTranslation('dashboard')
  const maxValue = Math.max(...months.map((month) => month.income), 1)
  const totalIncome = months.reduce((sum, month) => sum + month.income, 0)

  return (
    <Card className={styles['panel']}>
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
      </div>

      {totalIncome === 0 ? <EmptyState icon={<WalletIcon size={24} />} title={t('financialOverview.emptyTitle')} description={t('financialOverview.emptyDescription')} /> : <div className={styles['chart']} role="list" aria-label={t('financialOverview.title')}>
        {months.map((month) => (
          <div key={month.label} className={styles['month']} role="listitem" aria-label={month.label + ': ' + formatCurrency(month.income)}>
            <span className={styles['amount']} aria-hidden="true">{new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(month.income)}</span><div className={styles['bars']} aria-hidden="true">
              <span
                className={cx(styles['bar'], styles['barIncome'])}
                style={{ height: `${String((month.income / maxValue) * 100)}%` }}
              />
            </div>
            <span className={cx('text-caption', styles['monthLabel'])}>{month.label}</span>
          </div>
        ))}
      </div>}
    </Card>
  )
}
