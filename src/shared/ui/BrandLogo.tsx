import { cx } from '@/shared/lib/cx'
import { BrandMark } from './BrandMark'
import styles from './BrandLogo.module.css'

export interface BrandLogoProps {
  /** Already-translated brand name (e.g. t('common:home.title')) - this
   * component stays i18n-free like the shells it renders inside. */
  name: string
  markSize?: number
  className?: string
}

/**
 * BrandMark + the "Habitex" wordmark, with the spacing/alignment/typography
 * every screen was already re-implementing by hand (AppShell's sidebar and
 * drawer, the Login hero). One component now, so brand identity can't drift
 * between screens or get duplicated again.
 */
export function BrandLogo({ name, markSize = 28, className }: BrandLogoProps) {
  return (
    <span className={cx(styles['logo'], className)}>
      <BrandMark size={markSize} />
      <span className={styles['wordmark']}>{name}</span>
    </span>
  )
}
