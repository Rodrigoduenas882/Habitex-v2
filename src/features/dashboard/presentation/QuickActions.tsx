import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { cx } from '@/shared/lib/cx'
import { IconBadge } from '@/shared/ui/IconBadge'
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

/**
 * registerPayment/uploadDocument send the user to the rentals list rather
 * than a relationship-scoped page (e.g. /rentals/:id/payments) - Dashboard
 * has no relationshipId to link to directly, so the user picks a rental
 * there and continues from its own contextual actions.
 */
const ACTION_DESTINATION: Record<ActionKey, string> = {
  addProperty: '/properties/new',
  createRental: '/rentals/new',
  registerPayment: '/rentals',
  uploadDocument: '/rentals',
}

export function QuickActions() {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()

  return (
    <div>
      <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>
        {t('quickActions.title')}
      </h2>
      <div className={styles['grid']}>
        {ACTIONS.map(({ key, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={styles['action']}
            onClick={() => {
              void navigate(ACTION_DESTINATION[key])
            }}
          >
            <IconBadge icon={<Icon size={16} />} tone="primary" size={28} radius="sm" />
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
