import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { ChevronDownIcon } from '@/shared/ui/icons'
import styles from './DashboardHeader.module.css'

export interface DashboardHeaderProps {
  /** Derived display name (see getDisplayNameFromEmail), or null if unknown. */
  name: string | null
}

export function DashboardHeader({ name }: DashboardHeaderProps) {
  const { t } = useTranslation('dashboard')

  return (
    <header className={styles['header']}>
      <div>
        <h1 className="text-h1">
          {name ? t('greeting.hello', { name }) : t('greeting.helloGeneric')}
        </h1>
        <p className={cx('text-body', 'text-muted', styles['subtitle'])}>
          {t('greeting.subtitle')}
        </p>
      </div>

      {/* Visual only for this iteration - no period logic without real data
          to filter by yet (see task scope). */}
      <button type="button" className={styles['periodButton']}>
        {t('greeting.period')}
        <ChevronDownIcon size={16} />
      </button>
    </header>
  )
}
