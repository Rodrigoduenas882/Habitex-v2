import { useTranslation } from 'react-i18next'
import { useActiveAdministration } from '@/features/administration/application/useActiveAdministration'
import { AdministrationPicker } from '@/features/administration/presentation/AdministrationPicker'
import { useAuthSession } from '@/features/auth/application/useAuthSession'
import { useProperties } from '@/features/properties/application/useProperties'
import { Alert } from '@/shared/ui/Alert'
import { AlertTriangleIcon, BuildingIcon, UsersIcon, WalletIcon } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'
import { useDashboardAttention } from '../application/useDashboardAttention'
import { useDashboardFinancials } from '../application/useDashboardFinancials'
import { useDashboardOccupancy } from '../application/useDashboardOccupancy'
import { AttentionPanel, type AttentionItem } from './AttentionPanel'
import { DashboardHeader } from './DashboardHeader'
import styles from './DashboardPage.module.css'
import { FinancialOverview } from './FinancialOverview'
import { getDisplayNameFromEmail } from './getDisplayNameFromEmail'
import { KpiCard } from './KpiCard'
import { PropertiesOverview } from './PropertiesOverview'
import { usePropertyOccupancy } from './usePropertyOccupancy'
import { QuickActions } from './QuickActions'

/** Plain Intl.NumberFormat('es-CO'), no currency selector or decimals - same
 * local-formatter convention every feature defines for itself (see e.g.
 * RentalPaymentsPage's/RentalChargesPage's own formatAmount). */
function formatCurrency(value: number): string {
  return `$${new Intl.NumberFormat('es-CO').format(value)}`
}

/** Stored as a plain date (no time/zone) - parsed at local midnight so it
 * never shifts a day depending on the viewer's timezone, same pattern as
 * RentalPaymentsPage's own formatDate. */
function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`),
  )
}

export interface DashboardViewProps {
  administrationId: string
}

/**
 * The real page body, mounted only once administrationId is resolved (same
 * loading/error/none/selection-required/resolved split as RentalPaymentsPage/
 * RentalChargesPage). Every KPI/section below is wired to its own real
 * query - no dashboard-mock-data import remains here, and no fabricated
 * trend/value ever fills in for a loading or errored query. Strictly
 * read-only: no mutation of any kind exists anywhere in this page.
 */
function DashboardView({ administrationId }: DashboardViewProps) {
  const { data: session } = useAuthSession()
  const { t } = useTranslation('dashboard')
  const displayName = getDisplayNameFromEmail(session?.email)

  const propertiesQuery = useProperties(administrationId)
  const occupancy = useDashboardOccupancy(administrationId)
  const financials = useDashboardFinancials(administrationId)
  const attention = useDashboardAttention(administrationId)
  const propertyOccupancy = usePropertyOccupancy(administrationId)

  const attentionItems: AttentionItem[] = attention.reportedPayments.map((payment) => ({
    id: payment.id,
    kind: 'payment',
    subtitle: formatDate(payment.paymentDate),
    meta: formatCurrency(payment.amount),
    rentalRelationshipId: payment.rentalRelationshipId,
  }))

  const occupancyTrend =
    occupancy.status === 'error'
      ? t('kpis.loadError')
      : occupancy.status === 'ready' && occupancy.percentage === null
        ? t('kpis.occupancyNoData')
        : occupancy.status === 'ready'
          ? t('kpis.occupancyTrend', { occupied: occupancy.occupiedUnits, total: occupancy.totalUnits })
          : undefined

  return (
    <div className={styles['page']}>
      <DashboardHeader name={displayName} />

      <div className={styles['kpiGrid']}>
        <KpiCard
          icon={<WalletIcon size={18} />}
          label={t('kpis.monthlyIncome')}
          tone="success"
          value={
            financials.status === 'loading' ? (
              <Skeleton height={32} width={96} data-testid="kpi-monthlyIncome-loading" />
            ) : financials.status === 'error' ? (
              '—'
            ) : (
              formatCurrency(financials.monthlyIncome)
            )
          }
          trend={financials.status === 'error' ? t('kpis.loadError') : undefined}
        />
        <KpiCard
          icon={<AlertTriangleIcon size={18} />}
          label={t('kpis.receivable')}
          tone="warning"
          value={
            financials.status === 'loading' ? (
              <Skeleton height={32} width={96} data-testid="kpi-receivable-loading" />
            ) : financials.status === 'error' ? (
              '—'
            ) : (
              formatCurrency(financials.monthlyReceivable)
            )
          }
          trend={financials.status === 'error' ? t('kpis.loadError') : undefined}
        />
        <KpiCard
          icon={<UsersIcon size={18} />}
          label={t('kpis.occupancy')}
          tone="info"
          value={
            occupancy.status === 'loading' ? (
              <Skeleton height={32} width={64} data-testid="kpi-occupancy-loading" />
            ) : occupancy.status === 'error' || occupancy.percentage === null ? (
              '—'
            ) : (
              `${String(occupancy.percentage)}%`
            )
          }
          trend={occupancyTrend}
        />
        <KpiCard
          icon={<BuildingIcon size={18} />}
          label={t('kpis.properties')}
          tone="neutral"
          value={
            propertiesQuery.isLoading ? (
              <Skeleton height={32} width={48} data-testid="kpi-properties-loading" />
            ) : propertiesQuery.isError ? (
              '—'
            ) : (
              String(propertiesQuery.data?.length ?? 0)
            )
          }
          trend={propertiesQuery.isError ? t('kpis.loadError') : undefined}
          to="/properties"
        />
      </div>

      <QuickActions />

      {/* DS-004: AttentionPanel (actionable) renders before FinancialOverview
          (informational) so mobile's single-column stack shows the
          actionable list first - `.analytics`'s own grid-template-columns
          is mirrored (1fr 2fr instead of 2fr 1fr) to keep desktop's visual
          weight distribution identical; the wider column still goes to the
          richer chart, it's now just the second/right child. */}
      <div className={styles['analytics']}>
        {attention.status === 'loading' ? (
          <Skeleton height={280} radius="lg" data-testid="attention-panel-loading" />
        ) : attention.status === 'error' ? (
          <Alert tone="danger">{t('attention.loadError')}</Alert>
        ) : (
          <AttentionPanel items={attentionItems} />
        )}

        {financials.status === 'loading' ? (
          <Skeleton height={280} radius="lg" data-testid="financial-overview-loading" />
        ) : financials.status === 'error' ? (
          <Alert tone="danger">{t('financialOverview.loadError')}</Alert>
        ) : (
          <FinancialOverview months={financials.monthlySeries} />
        )}
      </div>

      {propertiesQuery.isLoading ? (
        <Skeleton height={240} radius="lg" data-testid="properties-overview-loading" />
      ) : propertiesQuery.isError ? (
        <Alert tone="danger">{t('properties.loadError')}</Alert>
      ) : (
        <PropertiesOverview properties={propertiesQuery.data ?? []} occupancy={propertyOccupancy} />
      )}
    </div>
  )
}

/**
 * Dashboard: the authenticated landing page, now wired to real data. Every
 * section reads from its own real hook (useProperties, useDashboardOccupancy,
 * useDashboardFinancials, useDashboardAttention, plus the presentation-local
 * usePropertyOccupancy for PropertyCard's per-property status) - no
 * dashboard-mock-data import remains anywhere in this file.
 */
export default function DashboardPage() {
  const { t } = useTranslation('dashboard')
  const currentAdministration = useActiveAdministration()

  if (currentAdministration.status === 'loading') {
    return (
      <div className={styles['page']}>
        <Skeleton height={32} width={240} />
        <Skeleton height={160} radius="lg" />
      </div>
    )
  }

  if (currentAdministration.status === 'error') {
    return (
      <div className={styles['page']}>
        <Alert tone="danger" title={t('errors.administrationTitle')}>
          {t('errors.administrationDescription')}
        </Alert>
      </div>
    )
  }

  if (currentAdministration.status === 'none') {
    return (
      <div className={styles['page']}>
        <Alert tone="danger">{t('noAdministration.title')}</Alert>
      </div>
    )
  }

  if (currentAdministration.status === 'selection-required') {
    return (
      <div className={styles['page']}>
        <AdministrationPicker options={currentAdministration.options} onSelect={currentAdministration.select} />
      </div>
    )
  }

  return <DashboardView administrationId={currentAdministration.administration.id} />
}
