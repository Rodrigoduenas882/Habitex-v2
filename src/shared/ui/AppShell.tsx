import { useEffect, useState, type ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'
import styles from './AppShell.module.css'
import { Avatar } from './Avatar'
import { BrandLogo } from './BrandLogo'
import { CloseIcon, LogOutIcon, MenuIcon } from './icons'
import { IconButton } from './IconButton'

export interface AppShellNavItem {
  key: string
  label: string
  icon: ReactNode
  active?: boolean
}

export interface AppShellProps {
  className?: string
  brandName: string
  navItems: AppShellNavItem[]
  /** Subset of navItems shown in the mobile bottom bar (key match). */
  bottomNavKeys: string[]
  moreLabel: string
  openNavLabel: string
  closeNavLabel: string
  userEmail: string
  onLogout: () => void
  logoutLabel: string
  logoutPending?: boolean
  /** Rendered in the topbar, before the user email/avatar. Optional slot so
   * this component stays free of any specific control's own i18n/logic. */
  themeControl?: ReactNode
  children: ReactNode
}

/**
 * The Habitex app shell: sidebar (desktop) + topbar + drawer/bottom nav
 * (mobile/tablet). Pure presentation - no i18n, no auth, no mock data - so
 * both the real authenticated layout and /ui-preview render the exact same
 * component instead of two parallel implementations.
 */
export function AppShell({
  className,
  brandName,
  navItems,
  bottomNavKeys,
  moreLabel,
  openNavLabel,
  closeNavLabel,
  userEmail,
  onLogout,
  logoutLabel,
  logoutPending = false,
  themeControl,
  children,
}: AppShellProps) {
  const [isDrawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!isDrawerOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDrawerOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDrawerOpen])

  const bottomNavItems = bottomNavKeys
    .map((key) => navItems.find((item) => item.key === key))
    .filter((item): item is AppShellNavItem => item != null)

  const navList = (onNavigate?: () => void) => (
    <nav className={styles['nav']}>
      {navItems.map((item) => (
        <button
          key={item.key}
          type="button"
          className={cx(styles['navItem'], item.active && styles['navItemActive'])}
          aria-current={item.active ? 'page' : undefined}
          onClick={onNavigate}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  )

  return (
    <div className={cx(styles['shell'], className)} data-testid="app-shell">
      <aside className={styles['sidebar']} data-testid="app-shell-sidebar">
        <div className={cx(styles['brand'], styles['sidebarBrand'])}>
          <BrandLogo name={brandName} />
        </div>
        {navList()}
      </aside>

      <div
        className={cx(styles['backdrop'], isDrawerOpen && styles['backdropOpen'])}
        onClick={() => {
          setDrawerOpen(false)
        }}
      />

      <div
        className={cx(styles['drawer'], isDrawerOpen && styles['drawerOpen'])}
        // `inert` (not aria-hidden) so the drawer's buttons stop being
        // keyboard-focusable while closed, instead of just visually hidden.
        inert={!isDrawerOpen}
      >
        <div className={styles['drawerHeader']}>
          <div className={styles['brand']}>
            <BrandLogo name={brandName} />
          </div>
          <IconButton
            icon={<CloseIcon size={18} />}
            aria-label={closeNavLabel}
            onClick={() => {
              setDrawerOpen(false)
            }}
          />
        </div>
        {navList(() => {
          setDrawerOpen(false)
        })}
      </div>

      <div className={styles['body']}>
        <header className={styles['topbar']} data-testid="app-shell-topbar">
          <div className={styles['topbarStart']}>
            <IconButton
              icon={<MenuIcon size={20} />}
              aria-label={openNavLabel}
              className={styles['menuButton']}
              onClick={() => {
                setDrawerOpen(true)
              }}
            />
          </div>
          <div className={styles['topbarEnd']}>
            {themeControl}
            <span className={styles['userEmail']}>{userEmail}</span>
            <Avatar name={userEmail} size={32} />
            <IconButton
              icon={<LogOutIcon size={18} />}
              aria-label={logoutLabel}
              onClick={onLogout}
              disabled={logoutPending}
            />
          </div>
        </header>

        <main className={styles['main']} data-testid="app-shell-main">
          {children}
        </main>

        <nav className={styles['bottomNav']} aria-label={brandName}>
          {bottomNavItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={cx(styles['bottomNavItem'], item.active && styles['bottomNavItemActive'])}
              aria-current={item.active ? 'page' : undefined}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <button
            type="button"
            className={styles['bottomNavItem']}
            onClick={() => {
              setDrawerOpen(true)
            }}
          >
            <MenuIcon size={20} />
            {moreLabel}
          </button>
        </nav>
      </div>
    </div>
  )
}
