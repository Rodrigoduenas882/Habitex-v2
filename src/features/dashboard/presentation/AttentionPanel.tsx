import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Card } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Alert } from '@/shared/ui/Alert'
import { Skeleton } from '@/shared/ui/Skeleton'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ArrowRightIcon, CheckIcon } from '@/shared/ui/icons'
import styles from './AttentionPanel.module.css'

export interface AttentionItem {
  id: string
  kind: 'payment' | 'overdue'
  identityLabel?: string
  subtitle: string
  meta: string
  rentalRelationshipId: string
}
export interface AttentionPanelProps {
  items: readonly AttentionItem[]
  overdueItems?: readonly AttentionItem[]
  overdueState?: 'loading' | 'error' | 'ready'
}
export function AttentionPanel({ items, overdueItems = [], overdueState = 'ready' }: AttentionPanelProps) {
  const { t } = useTranslation('dashboard')
  function table(rows: readonly AttentionItem[], overdue: boolean) {
    return <div className={styles['tableWrap']} role="region" aria-label={t(overdue ? 'attention.overdueTitle' : 'attention.reportedTitle')} tabIndex={0}>
      <table className={styles['table']}>
        <caption className="sr-only">{t(overdue ? 'attention.overdueTitle' : 'attention.reportedTitle')}</caption>
        <thead><tr><th scope="col">{t('attention.propertyColumn')}</th><th scope="col">{t('attention.amountColumn')}</th><th scope="col"><span className="sr-only">{t('attention.actionColumn')}</span></th></tr></thead>
        <tbody>{rows.map(item => <tr key={item.id}>
          <td>
            <p className={styles['itemTitle']}>{item.identityLabel ?? t('attention.rentalReference', { id: item.rentalRelationshipId })}</p>
            <p className="text-caption">{t(overdue ? 'attention.chargeOverdue' : 'attention.paymentPending')}</p>
            <p className="text-caption">{item.subtitle}</p>
          </td>
          <td className={styles['amount']}>{item.meta}</td>
          <td><Link to={'/rentals/' + item.rentalRelationshipId + (overdue ? '/charges' : '/payments')} className={styles['action']}>{t('attention.view')}<ArrowRightIcon size={14} aria-hidden="true" /></Link></td>
        </tr>)}</tbody>
      </table>
    </div>
  }
  return <Card className={styles['panel']}>
    <div className={styles['header']}><div><h2 className="text-h3">{t('attention.title')}</h2><p className="text-caption">{t('attention.subtitle')}</p></div></div>
    {items.length === 0 && overdueItems.length === 0 && overdueState === 'ready' ? (
      <EmptyState icon={<CheckIcon size={24} />} title={t('attention.emptyTitle')} description={t('attention.emptyDescription')} />
    ) : <>
      <section aria-label={t('attention.reportedTitle')}>
        <h3 className={styles['groupTitle']}>{t('attention.reportedTitle')}<Badge tone="info">{items.length}</Badge></h3>
        {items.length ? table(items, false) : <p className={styles['groupEmpty']}>{t('attention.noReported')}</p>}
      </section>
      <section aria-label={t('attention.overdueTitle')} className={styles['overdueGroup']}>
        <h3 className={styles['groupTitle']}>{t('attention.overdueTitle')}{overdueState === 'ready' ? <Badge tone="danger">{overdueItems.length}</Badge> : null}</h3>
        <p className="text-caption">{t('attention.overdueScope')}</p>
        {overdueState === 'loading' ? <Skeleton height={64} /> : overdueState === 'error' ? <Alert tone="danger">{t('attention.overdueError')}</Alert> : overdueItems.length ? table(overdueItems, true) : <p className={styles['groupEmpty']}>{t('attention.noOverdue')}</p>}
      </section>
    </>}
  </Card>
}
