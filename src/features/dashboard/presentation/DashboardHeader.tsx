import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import styles from './DashboardHeader.module.css'
export interface DashboardHeaderProps { name: string | null }
export function DashboardHeader({ name }: DashboardHeaderProps) {
  const { t } = useTranslation('dashboard')
  const today = new Date()
  return (
    <header className={styles['header']}>
      <div>
        <p className={styles['eyebrow']}>{t('greeting.eyebrow')}</p>
        <h1 className="text-h1">{name ? t('greeting.hello', { name }) : t('greeting.helloGeneric')}</h1>
        <p className={cx('text-body', 'text-muted', styles['subtitle'])}>{t('greeting.subtitle')}</p>
      </div>
      <time className={styles['date']} dateTime={today.toLocaleDateString('en-CA')}>
        {new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(today)}
      </time>
    </header>
  )
}
