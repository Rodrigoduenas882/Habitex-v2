import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import { AlertTriangleIcon, FileTextIcon, HomeIcon, KeyIcon, WalletIcon } from '@/shared/ui/icons'
import styles from './HabitexExampleContent.module.css'
import { uiPreviewMockData } from './mock-data'

/**
 * Realistic composition mock for /ui-preview only. Values come from
 * mock-data.ts (page-local), never from domain, stores or APIs.
 */
export function HabitexExampleContent() {
  const { t } = useTranslation(['uiPreview', 'common'])

  return (
    <div className={styles['wrapper']}>
      <div className={styles['greeting']}>
        <h1 className="text-h1">{t('example.greeting')}</h1>
        <p className="text-body text-muted">{t('example.subtitle')}</p>
      </div>

      <div className={styles['statGrid']}>
        <Card className={styles['statCard']}>
          <div className={styles['statHeader']}>
            <KeyIcon size={16} className={styles['statIcon']} />
            <p className="text-caption">{t('example.activeRentals')}</p>
          </div>
          <p className={cx('text-h1', 'tabular-nums', styles['statValue'])}>
            {uiPreviewMockData.activeRentalsCount}
          </p>
        </Card>
        <Card className={styles['statCard']}>
          <div className={styles['statHeader']}>
            <WalletIcon size={16} className={styles['statIcon']} />
            <p className="text-caption">{t('example.receivedThisMonth')}</p>
          </div>
          <p className={cx('text-h1', 'tabular-nums', styles['statValue'])}>
            {uiPreviewMockData.receivedThisMonth}
          </p>
        </Card>
        <Card className={styles['statCard']}>
          <div className={styles['statHeader']}>
            <AlertTriangleIcon size={16} className={styles['statIcon']} />
            <p className="text-caption">{t('example.pending')}</p>
          </div>
          <p
            className={cx(
              'text-h1',
              'tabular-nums',
              styles['statValue'],
              styles['statValueWarning'],
            )}
          >
            {uiPreviewMockData.pendingAmount}
          </p>
        </Card>
      </div>

      <div>
        <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>
          {t('example.attention')}
        </h2>
        <Card>
          <div className={styles['attentionList']}>
            <div className={styles['attentionRow']}>
              <span className={styles['attentionIcon']}>
                <AlertTriangleIcon size={18} />
              </span>
              <div className={styles['attentionBody']}>
                <div className={styles['attentionTitleRow']}>
                  <p className="text-body-sm" style={{ fontWeight: 600 }}>
                    {t('example.paymentPending')}
                  </p>
                  <p className={cx('text-body-sm', 'tabular-nums', styles['attentionAmount'])}>
                    {uiPreviewMockData.pendingPaymentAmount}
                  </p>
                </div>
                <p className="text-caption">{t('example.apartment302')}</p>
                <p className="text-caption">{t('example.dueDate')}</p>
              </div>
            </div>

            <div className={styles['attentionRow']}>
              <span className={styles['attentionIcon']}>
                <FileTextIcon size={18} />
              </span>
              <div className={styles['attentionBody']}>
                <div className={styles['attentionTitleRow']}>
                  <p className="text-body-sm" style={{ fontWeight: 600 }}>
                    {t('example.contractPendingSignature')}
                  </p>
                  <Badge tone="warning">{t('example.pending')}</Badge>
                </div>
                <p className="text-caption">{t('example.room2')}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card interactive>
        <div className={styles['propertyRow']}>
          <div className={styles['propertyInfo']}>
            <div className={styles['propertyThumb']} aria-hidden="true">
              <HomeIcon size={20} />
            </div>
            <div>
              <p className={styles['propertyTitle']}>{t('example.propertyRowTitle')}</p>
              <p className="text-caption">{t('example.propertyRowSubtitle')}</p>
            </div>
          </div>
          <Badge tone="primary">{t('common:status.active')}</Badge>
        </div>
      </Card>
    </div>
  )
}
