import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { AppShell, type AppShellNavItem } from '@/shared/ui/AppShell'
import {
  BuildingIcon,
  FileTextIcon,
  HomeIcon,
  KeyIcon,
  SettingsIcon,
  UsersIcon,
  WalletIcon,
  type IconProps,
} from '@/shared/ui/icons'
import styles from './AppShellPreview.module.css'
import { uiPreviewMockData } from './mock-data'

type NavKey = 'home' | 'rentals' | 'properties' | 'people' | 'finances' | 'documents' | 'settings'

const NAV_KEYS: Array<{ key: NavKey; icon: (props: IconProps) => ReactNode }> = [
  { key: 'home', icon: HomeIcon },
  { key: 'rentals', icon: KeyIcon },
  { key: 'properties', icon: BuildingIcon },
  { key: 'people', icon: UsersIcon },
  { key: 'finances', icon: WalletIcon },
  { key: 'documents', icon: FileTextIcon },
  { key: 'settings', icon: SettingsIcon },
]

const BOTTOM_NAV_KEYS: NavKey[] = ['home', 'rentals', 'properties', 'finances']
const ACTIVE_KEY: NavKey = 'home'

export interface AppShellPreviewProps {
  children: ReactNode
}

/**
 * Visual-only preview of the real AppShell (shared/ui/AppShell): mock nav
 * state and a no-op logout, purely to evaluate the design language. The
 * real authenticated app renders the same AppShell component with real data
 * (see app/layouts/AuthenticatedLayout.tsx).
 */
export function AppShellPreview({ children }: AppShellPreviewProps) {
  const { t } = useTranslation(['common', 'auth'])

  const navItems: AppShellNavItem[] = NAV_KEYS.map(({ key, icon: Icon }) => ({
    key,
    label: t(`common:nav.${key}`),
    icon: <Icon size={18} />,
    active: key === ACTIVE_KEY,
  }))

  return (
    <AppShell
      className={cx(styles['previewShell'])}
      brandName={t('common:home.title')}
      navItems={navItems}
      bottomNavKeys={BOTTOM_NAV_KEYS}
      moreLabel={t('common:nav.more')}
      openNavLabel={t('common:nav.openMenu')}
      closeNavLabel={t('common:nav.closeMenu')}
      userEmail={uiPreviewMockData.userEmail}
      // Not passing themeControl here on purpose: the page already has one
      // ThemeControl in its own header (source of truth for this preview),
      // and useTheme() instances don't share live state across each other -
      // a second one here would drift out of sync with the first.
      logoutLabel={t('auth:logout.action')}
      onLogout={() => {
        // Visual-only preview - no real session to sign out of.
      }}
    >
      {children}
    </AppShell>
  )
}
