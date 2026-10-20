import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { ThemeControl } from '@/shared/theme/ThemeControl'
import { BrandLogo } from '@/shared/ui/BrandLogo'
import styles from './AuthHeroPanel.module.css'

export interface AuthHeroPanelProps {
  /**
   * Independent review (visual, round 2): Login/Signup keep the commercial
   * headline ("Más que arriendos, tranquilidad."), but /forgot-password and
   * /reset-password now pass their own, contextual copy - a marketing tagline
   * felt mismatched on a password-recovery screen, especially its own
   * invalid-link error state. Required (no internal default) so every call
   * site is explicit about which copy it shows, instead of silently
   * inheriting Login's.
   */
  headline: ReactNode
  tagline: string
  /**
   * Login-exclusive decorative content (the floating glass stats-card
   * preview) - DESIGN.md §10 keeps glassmorphism itself exclusive to
   * Login even after this hero photo became shared across every public
   * auth screen, so only LoginPage ever passes this. Every other screen
   * renders this component with no children at all.
   */
  children?: ReactNode
}

/**
 * The property-photo hero (day/night crossfade + scrim + brand + headline/
 * tagline) shared by every public auth screen - /login, /signup,
 * /forgot-password, /reset-password (DESIGN.md §10, amended: this is now
 * Habitex's public-auth visual language, not a Login-only pattern).
 * Extracted from the original LoginPage.tsx unchanged in substance - same
 * markup, same CSS, same crossfade mechanism, just reusable.
 */
export function AuthHeroPanel({ headline, tagline, children }: AuthHeroPanelProps) {
  const { t } = useTranslation(['auth', 'common'])

  return (
    <aside className={styles['heroPanel']}>
      <div className={styles['heroPhoto']} aria-hidden="true">
        <div className={cx(styles['heroPhotoLayer'], styles['heroPhotoDay'])} />
        <div className={cx(styles['heroPhotoLayer'], styles['heroPhotoNight'])} />
        <div className={styles['heroScrim']} />
      </div>

      <div className={styles['heroContent']}>
        <div className={styles['heroTop']}>
          <div className={styles['brandMarkRow']}>
            <BrandLogo name={t('common:home.title')} />
          </div>
          <ThemeControl />
        </div>

        <div className={styles['heroBottom']}>
          <div className={styles['heroCopy']}>
            <p className={styles['heroHeadline']}>{headline}</p>
            <p className={cx('text-body', styles['heroTagline'])}>{tagline}</p>
          </div>

          {children}
        </div>
      </div>
    </aside>
  )
}
