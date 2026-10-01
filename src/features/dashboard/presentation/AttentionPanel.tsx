import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cx } from '@/shared/lib/cx'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { IconBadge } from '@/shared/ui/IconBadge'
import { ArrowRightIcon, CheckIcon, WalletIcon } from '@/shared/ui/icons'
import styles from './AttentionPanel.module.css'

/**
 * Only a REPORTED payment awaiting owner confirmation has a real, direct,
 * unambiguous backend signal today - the old mock's 'contract'/'document'
 * kinds have no analog in the current schema (confirmed by prior research),
 * so this type only ever carries 'payment' now, rather than keeping dead
 * kind branches that structurally can never appear.
 *
 * `rentalRelationshipId` (DS-004) is what makes the "Ver" action honest: it's
 * the exact relationship whose /rentals/:id/payments page lists this same
 * REPORTED payment for confirm/reject - carried straight through from
 * Payment.rentalRelationshipId, never fabricated here.
 */
export interface AttentionItem {
  id: string
  kind: 'payment'
  subtitle: string
  meta: string
  rentalRelationshipId: string
}

export interface AttentionPanelProps {
  items: readonly AttentionItem[]
}

export function AttentionPanel({ items }: AttentionPanelProps) {
  const { t } = useTranslation('dashboard')

  return (
    <Card>
      <h2 className={cx('text-h3', styles['title'])}>{t('attention.title')}</h2>

      {items.length === 0 ? (
        <EmptyState
          icon={<CheckIcon size={24} />}
          title={t('attention.emptyTitle')}
          description={t('attention.emptyDescription')}
        />
      ) : (
        <div className={styles['list']}>
          {items.map((item) => (
            <div key={item.id} className={styles['row']}>
              <IconBadge icon={<WalletIcon size={16} />} tone="warning" size={32} radius="md" />
              <div className={styles['body']}>
                <div className={styles['titleRow']}>
                  <p className={cx('text-body-sm', styles['itemTitle'])}>{t('attention.paymentPending')}</p>
                  <p className={cx('text-body-sm', 'tabular-nums', styles['meta'])}>{item.meta}</p>
                </div>
                <p className="text-caption">{item.subtitle}</p>
              </div>
              <Link to={`/rentals/${item.rentalRelationshipId}/payments`} className={styles['action']}>
                {t('attention.view')}
                <ArrowRightIcon size={14} className={styles['actionArrow']} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
