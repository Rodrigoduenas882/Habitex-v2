import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { useLogout } from '@/features/auth/application/useLogout'
import { useAuthSession } from '@/features/auth/application/useAuthSession'
import { HabitexBootScreen } from '@/shared/components/HabitexBootScreen'
import { ThemeControl } from '@/shared/theme/ThemeControl'
import { AppShell, type AppShellNavItem } from '@/shared/ui/AppShell'
import {
  BuildingIcon,
  FileTextIcon,
  HomeIcon,
  KeyIcon,
  SettingsIcon,
  UsersIcon,
  WalletIcon,
} from '@/shared/ui/icons'

/**
 * Only "Inicio" is a real route so far - the rest are planned sections shown
 * for navigation context, matching the approved Design System shell. They
 * don't navigate anywhere yet; that's intentional, not a bug.
 */
const NAV_KEYS = [
  { key: 'home', icon: HomeIcon },
  { key: 'rentals', icon: KeyIcon },
  { key: 'properties', icon: BuildingIcon },
  { key: 'people', icon: UsersIcon },
  { key: 'finances', icon: WalletIcon },
  { key: 'documents', icon: FileTextIcon },
  { key: 'settings', icon: SettingsIcon },
] as const

const BOTTOM_NAV_KEYS = ['home', 'rentals', 'properties', 'finances']

export function AuthenticatedLayout() {
  const { t } = useTranslation(['common', 'auth'])
  const { data: session } = useAuthSession()
  const logout = useLogout()

  const navItems: AppShellNavItem[] = NAV_KEYS.map(({ key, icon: Icon }) => ({
    key,
    label: t(`common:nav.${key}`),
    icon: <Icon size={18} />,
    active: key === 'home',
  }))

  // Hide protected content the instant sign-out is requested, instead of
  // waiting for the session query to actually settle to null - avoids ever
  // showing private content mid-transition, without an artificial delay.
  if (logout.isPending) {
    return <HabitexBootScreen />
  }

  return (
    <AppShell
      brandName={t('common:home.title')}
      navItems={navItems}
      bottomNavKeys={BOTTOM_NAV_KEYS}
      moreLabel={t('common:nav.more')}
      openNavLabel={t('common:nav.openMenu')}
      closeNavLabel={t('common:nav.closeMenu')}
      userEmail={session?.email ?? ''}
      themeControl={<ThemeControl />}
      logoutLabel={t('auth:logout.action')}
      logoutPending={logout.isPending}
      onLogout={() => {
        logout.mutate()
      }}
    >
      <Outlet />
    </AppShell>
  )
}
