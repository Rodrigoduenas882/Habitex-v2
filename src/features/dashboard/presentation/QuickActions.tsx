import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import {
  ArrowRightIcon,
  BuildingIcon,
  FileTextIcon,
  KeyIcon,
  WalletIcon,
  type IconProps,
} from '@/shared/ui/icons'
import styles from './QuickActions.module.css'

type ActionKey = 'addProperty' | 'createRental' | 'registerPayment' | 'uploadDocument'

const ACTIONS: Array<{ key: ActionKey; icon: (props: IconProps) => ReactNode }> = [
  { key: 'addProperty', icon: BuildingIcon },
  { key: 'createRental', icon: KeyIcon },
  { key: 'registerPayment', icon: WalletIcon },
  { key: 'uploadDocument', icon: FileTextIcon },
]

// Inert by design: the underlying flows (properties/rentals/payments/documents) don't exist yet.
export function QuickActions() {
  const { t } = useTranslation('dashboard')

  return (
    <div>
      <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>
        {t('quickActions.title')}
      </h2>
      <div className={styles['grid']}>
        {ACTIONS.map(({ key, icon: Icon }) => (
          <button key={key} type="button" className={styles['action']}>
            <span className={styles['iconBadge']} aria-hidden="true">
              <Icon size={16} />
            </span>
            <span className={cx('text-body-sm', styles['label'])}>
              {t(`quickActions.${key}`)}
            </span>
            <ArrowRightIcon size={16} className={styles['arrow']} />
          </button>
        ))}
      </div>
    </div>
  )
}
