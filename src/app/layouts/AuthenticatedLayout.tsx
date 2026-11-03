import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router-dom'
import { SubscriptionStatusBanner } from '@/features/administration/presentation/SubscriptionStatusBanner'
import { useLogout } from '@/features/auth/application/useLogout'
import { useAuthSession } from '@/features/auth/application/useAuthSession'
import { HabitexBootScreen } from '@/shared/components/HabitexBootScreen'
import { getDisplayNameFromEmail } from '@/features/dashboard/presentation/getDisplayNameFromEmail'
import { ThemeControl } from '@/shared/theme/ThemeControl'
import { AppShell, type AppShellNavItem } from '@/shared/ui/AppShell'
import { BuildingIcon, HomeIcon, KeyIcon, SettingsIcon, type IconProps } from '@/shared/ui/icons'

type NavKey = 'home' | 'properties' | 'rentals' | 'settings'

/**
 * Unified navigation (approved 2026-10, Figma "Habitex - Design Lab"):
 * exactly these 4 destinations, in this order - Inicio, Inmuebles,
 * Arriendos, Configuración. "Inicio", "Inmuebles" and "Arriendos" are real
 * routes; "Configuración" stays inert (no `to`) because implementing that
 * screen is explicitly out of scope for this increment - same "Próximamente"
 * treatment AppShell already gives any route-less item, not a new pattern.
 * Personas/Finanzas/Documentos were removed entirely (not just hidden) -
 * they had no real route before either, and the approved navigation has no
 * place for them.
 */
const NAV_KEYS: ReadonlyArray<{
  key: NavKey
  icon: (props: IconProps) => ReactNode
  to?: string
}> = [
  { key: 'home', icon: HomeIcon, to: '/' },
  { key: 'properties', icon: BuildingIcon, to: '/properties' },
  { key: 'rentals', icon: KeyIcon, to: '/rentals' },
  { key: 'settings', icon: SettingsIcon },
]

const BOTTOM_NAV_KEYS = ['home', 'properties', 'rentals', 'settings']

export function AuthenticatedLayout() {
  const { t } = useTranslation(['common', 'auth'])
  const { data: session } = useAuthSession()
  const logout = useLogout()
  const location = useLocation()

  const navItems: AppShellNavItem[] = NAV_KEYS.map(({ key, icon: Icon, to }) => ({
    key,
    label: t(`common:nav.${key}`),
    icon: <Icon size={18} />,
    // exactOptionalPropertyTypes: only include `to` when it actually has a
    // route, instead of assigning `to: undefined`.
    ...(to ? { to } : {}),
    active: to != null && (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)),
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
      comingSoonLabel={t('common:nav.comingSoon')}
      userEmail={session?.email ?? ''}
      userName={getDisplayNameFromEmail(session?.email) ?? session?.email ?? ''}
      collapseNavLabel={t('common:nav.collapse')}
      expandNavLabel={t('common:nav.expand')}
      userMenuLabel={t('common:nav.userMenu')}
      themeControl={<ThemeControl />}
      logoutLabel={t('auth:logout.action')}
      logoutPending={logout.isPending}
      onLogout={() => {
        logout.mutate()
      }}
    >
      <SubscriptionStatusBanner />
      <Outlet />
    </AppShell>
  )
}
