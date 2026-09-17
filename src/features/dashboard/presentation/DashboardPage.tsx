import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSession } from '@/features/auth/application/useAuthSession'
import { AlertTriangleIcon, BuildingIcon, UsersIcon, WalletIcon, type IconProps } from '@/shared/ui/icons'
import { AttentionPanel } from './AttentionPanel'
import { DashboardHeader } from './DashboardHeader'
import styles from './DashboardPage.module.css'
import { dashboardMockData, type DashboardKpi } from './dashboard-mock-data'
import { FinancialOverview } from './FinancialOverview'
import { getDisplayNameFromEmail } from './getDisplayNameFromEmail'
import { KpiCard } from './KpiCard'
import { PropertiesOverview } from './PropertiesOverview'
import { QuickActions } from './QuickActions'

const KPI_ICON: Record<DashboardKpi['key'], (props: IconProps) => ReactNode> = {
  monthlyIncome: WalletIcon,
  receivable: AlertTriangleIcon,
  occupancy: UsersIcon,
  properties: BuildingIcon,
}

/**
 * Dashboard Visual Foundation. Every number/list here comes from
 * dashboard-mock-data.ts (see that file's own doc comment) - no Supabase
 * calls, no business logic, purely the visual layer to evaluate now.
 */
export default function DashboardPage() {
  const { data: session } = useAuthSession()
  const { t } = useTranslation('dashboard')
  const displayName = getDisplayNameFromEmail(session?.email)

  return (
    <div className={styles['page']}>
      <DashboardHeader name={displayName} />

      <div className={styles['kpiGrid']}>
        {dashboardMockData.kpis.map((kpi) => {
          const Icon = KPI_ICON[kpi.key]
          return (
            <KpiCard
              key={kpi.key}
              icon={<Icon size={18} />}
              label={t(`kpis.${kpi.key}`)}
              value={kpi.value}
              tone={kpi.tone}
              trend={kpi.trend}
              trendTone={kpi.trendTone}
            />
          )
        })}
      </div>

      <QuickActions />

      <div className={styles['analytics']}>
        <FinancialOverview months={dashboardMockData.financials} />
        <AttentionPanel items={dashboardMockData.attentionItems} />
      </div>

      <PropertiesOverview properties={dashboardMockData.properties} />
    </div>
  )
}
