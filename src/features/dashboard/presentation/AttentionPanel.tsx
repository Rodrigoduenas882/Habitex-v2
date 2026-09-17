import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import {
  ArrowRightIcon,
  CheckIcon,
  FileTextIcon,
  KeyIcon,
  WalletIcon,
  type IconProps,
} from '@/shared/ui/icons'
import styles from './AttentionPanel.module.css'
import type { AttentionItem } from './dashboard-mock-data'

const KIND_META: Record<
  AttentionItem['kind'],
  {
    icon: (props: IconProps) => ReactNode
    tone: 'iconWarning' | 'iconNeutral'
    titleKey: 'attention.paymentPending' | 'attention.contractExpiring' | 'attention.documentPending'
  }
> = {
  payment: { icon: WalletIcon, tone: 'iconWarning', titleKey: 'attention.paymentPending' },
  contract: { icon: KeyIcon, tone: 'iconWarning', titleKey: 'attention.contractExpiring' },
  document: { icon: FileTextIcon, tone: 'iconNeutral', titleKey: 'attention.documentPending' },
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
          {items.map((item) => {
            const { icon: Icon, tone, titleKey } = KIND_META[item.kind]

            return (
              <div key={item.id} className={styles['row']}>
                <span className={cx(styles['icon'], styles[tone])} aria-hidden="true">
                  <Icon size={16} />
                </span>
                <div className={styles['body']}>
                  <div className={styles['titleRow']}>
                    <p className={cx('text-body-sm', styles['itemTitle'])}>{t(titleKey)}</p>
                    <p className={cx('text-body-sm', 'tabular-nums', styles['meta'])}>
                      {item.meta}
                    </p>
                  </div>
                  <p className="text-caption">{item.subtitle}</p>
                </div>
                <button type="button" className={styles['action']}>
                  {t('attention.view')}
                  <ArrowRightIcon size={14} className={styles['actionArrow']} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
