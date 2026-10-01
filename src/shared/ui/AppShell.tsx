import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
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
  /** Real route for this item. Omit to keep it inert (planned section, no
   * screen yet) - same visual treatment either way. */
  to?: string
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
  /** Shown on every inert (no `to`) nav item - sidebar/drawer get a small
   * visible label next to it, the bottom nav gets it as a screen-reader-only
   * description only (no room there). Optional so a caller that genuinely
   * has no inert items (or doesn't care to label them) isn't forced to pass
   * a string that's never used. */
  comingSoonLabel?: string
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
  comingSoonLabel,
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
      {navItems.map((item) => {
        if (item.to) {
          return (
            <Link
              key={item.key}
              to={item.to}
              className={cx(styles['navItem'], item.active && styles['navItemActive'])}
              aria-current={item.active ? 'page' : undefined}
              onClick={onNavigate}
            >
              {item.icon}
              <span className={styles['navItemLabel']}>{item.label}</span>
            </Link>
          )
        }

        const descriptionId = `${item.key}-coming-soon`
        return (
          // The sr-only description lives OUTSIDE the button on purpose: an
          // element's accessible name is computed from its own subtree's
          // visible text regardless of aria-describedby, so a description
          // span placed *inside* would still leak into the button's name
          // (making it "Finanzas Próximamente" instead of "Finanzas"). As a
          // sibling, it only ever contributes to the description.
          <Fragment key={item.key}>
            <button
              type="button"
              className={cx(styles['navItem'], styles['navItemDisabled'])}
              disabled
              aria-describedby={comingSoonLabel ? descriptionId : undefined}
            >
              {item.icon}
              <span className={styles['navItemLabel']}>{item.label}</span>
              {comingSoonLabel ? (
                <span className={styles['comingSoonLabel']} aria-hidden="true">
                  {comingSoonLabel}
                </span>
              ) : null}
            </button>
            {comingSoonLabel ? (
              <span id={descriptionId} className="sr-only">
                {comingSoonLabel}
              </span>
            ) : null}
          </Fragment>
        )
      })}
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

        <nav className={styles['bottomNav']} aria-label={brandName} data-testid="app-shell-bottom-nav">
          {bottomNavItems.map((item) => {
            if (item.to) {
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  className={cx(styles['bottomNavItem'], item.active && styles['bottomNavItemActive'])}
                  aria-current={item.active ? 'page' : undefined}
                >
                  {item.icon}
                  {item.label}
                </Link>
              )
            }

            const descriptionId = `${item.key}-coming-soon-mobile`
            return (
              <Fragment key={item.key}>
                <button
                  type="button"
                  className={cx(styles['bottomNavItem'], styles['bottomNavItemDisabled'])}
                  disabled
                  aria-describedby={comingSoonLabel ? descriptionId : undefined}
                >
                  {item.icon}
                  {item.label}
                </button>
                {comingSoonLabel ? (
                  <span id={descriptionId} className="sr-only">
                    {comingSoonLabel}
                  </span>
                ) : null}
              </Fragment>
            )
          })}
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
