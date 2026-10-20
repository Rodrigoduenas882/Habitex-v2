import type { ReactNode } from 'react'
import { AuthHeroPanel } from './AuthHeroPanel'
import styles from './AuthPageLayout.module.css'

export interface AuthPageLayoutProps {
  /** Forwarded as-is to AuthHeroPanel - see that component's own doc comment on why it's required, not shared internally. */
  heroHeadline: ReactNode
  heroTagline: string
  /** Login-only glass stats card, forwarded as-is to AuthHeroPanel - see that component's own doc comment. */
  heroContent?: ReactNode
  /** The page's own Card/form content. */
  children: ReactNode
}

/**
 * Shared two-column (desktop) / stacked (mobile) chrome for every public
 * auth screen - DESIGN.md §10 (amended): the property-photo hero is now
 * Habitex's shared public-auth visual language, not Login-exclusive.
 * Extracted from the original LoginPage.tsx so /login, /signup,
 * /forgot-password and /reset-password all render the identical hero
 * instead of four independent copies.
 */
export function AuthPageLayout({ heroHeadline, heroTagline, heroContent, children }: AuthPageLayoutProps) {
  return (
    <div className={styles['page']}>
      <AuthHeroPanel headline={heroHeadline} tagline={heroTagline}>
        {heroContent}
      </AuthHeroPanel>
      <main className={styles['formPanel']}>{children}</main>
    </div>
  )
}
