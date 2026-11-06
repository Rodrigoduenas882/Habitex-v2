import { Fragment, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cx } from '@/shared/lib/cx'
import styles from './AppShell.module.css'
import { Avatar } from './Avatar'
import { Button } from './Button'
import { BrandLogo } from './BrandLogo'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, LogOutIcon, MenuIcon } from './icons'
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
  userName?: string
  collapseNavLabel?: string
  expandNavLabel?: string
  userMenuLabel?: string
  userEmail: string
  onLogout: () => void
  logoutLabel: string
  logoutPending?: boolean
  /** Rendered inside the floating user menu. Optional slot so
   * this component stays free of any specific control's own i18n/logic. */
  themeControl?: ReactNode
  children: ReactNode
}

/**
 * The Habitex app shell: collapsible sidebar + floating user menu + drawer/bottom nav
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
  userName,
  collapseNavLabel = 'Contraer panel lateral',
  expandNavLabel = 'Expandir panel lateral',
  userMenuLabel = 'Menú de usuario',
  userEmail,
  onLogout,
  logoutLabel,
  logoutPending = false,
  themeControl,
  children,
}: AppShellProps) {
  const [isDrawerOpen, setDrawerOpen] = useState(false)
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false)
  const userMenuRef = useRef<HTMLDetailsElement>(null)
  // Whichever button actually opened the drawer (hamburger or the mobile
  // bottom nav's "more" button) - captured on open so focus returns to the
  // real trigger on close, not always a hardcoded one.
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null)
  const drawerCloseButtonRef = useRef<HTMLButtonElement>(null)
  const wasDrawerOpenRef = useRef(false)
  const location = useLocation()

  function openDrawer(event: MouseEvent<HTMLButtonElement>) {
    drawerTriggerRef.current = event.currentTarget
    setDrawerOpen(true)
  }
  useEffect(() => {
    userMenuRef.current?.removeAttribute('open')
  }, [location])
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !userMenuRef.current?.contains(event.target)) userMenuRef.current?.removeAttribute('open')
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && userMenuRef.current?.open) {
        userMenuRef.current.removeAttribute('open')
        userMenuRef.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeWithEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeWithEscape)
    }
  }, [])

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

  // Moves focus into the drawer on open (first focusable control - the
  // close button) and, on every close path (Escape, close button, outside
  // click, or a nav link navigating away), restores it to whichever button
  // actually opened it - but only if that trigger is still mounted; a route
  // change that unmounts it just leaves focus wherever the browser put it,
  // instead of forcing it onto a detached element.
  useEffect(() => {
    if (isDrawerOpen) {
      drawerCloseButtonRef.current?.focus()
    } else if (wasDrawerOpenRef.current) {
      drawerTriggerRef.current?.focus()
    }
    wasDrawerOpenRef.current = isDrawerOpen
  }, [isDrawerOpen])

  const bottomNavItems = bottomNavKeys
    .map((key) => navItems.find((item) => item.key === key))
    .filter((item): item is AppShellNavItem => item != null)

  const navList = (onNavigate?: () => void, region = 'sidebar') => (
    <nav className={styles['nav']}>
      {navItems.map((item) => {
        if (item.to) {
          return (
            <Link
              key={item.key}
              to={item.to}
              aria-label={item.label}
              title={item.label}
              className={cx(styles['navItem'], item.active && styles['navItemActive'])}
              aria-current={item.active ? 'page' : undefined}
              onClick={onNavigate}
            >
              {item.icon}
              <span className={styles['navItemLabel']}>{item.label}</span>
            </Link>
          )
        }

        const descriptionId = `${region}-${item.key}-coming-soon`
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
              aria-label={item.label}
              title={item.label}
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
      <aside className={cx(styles['sidebar'], isSidebarCollapsed && styles['sidebarCollapsed'])} data-testid="app-shell-sidebar">
        <div className={cx(styles['brand'], styles['sidebarBrand'])}>
          <BrandLogo name={brandName} className={cx(styles['sidebarBrandLogo'])} />
        </div>
        {navList()}
        <IconButton className={styles['collapseButton']}
          icon={isSidebarCollapsed ? <ChevronRightIcon size={18} /> : <ChevronLeftIcon size={18} />}
          aria-label={isSidebarCollapsed ? expandNavLabel : collapseNavLabel} aria-expanded={!isSidebarCollapsed}
          onClick={() => { setSidebarCollapsed(!isSidebarCollapsed) }} />
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
        role="dialog"
        aria-modal="true"
        aria-label={brandName}
        data-testid="app-shell-drawer"
      >
        <div className={styles['drawerHeader']}>
          <div className={styles['brand']}>
            <BrandLogo name={brandName} />
          </div>
          <IconButton
            ref={drawerCloseButtonRef}
            icon={<CloseIcon size={18} />}
            aria-label={closeNavLabel}
            onClick={() => {
              setDrawerOpen(false)
            }}
          />
        </div>
        {navList(() => {
          setDrawerOpen(false)
        }, 'drawer')}
      </div>

      {/* `inert` while the drawer is open: this is the entire reachable
          surface behind the overlay (the sidebar is already `display:none`
          at the widths where the drawer can show) - without it, Tab/Shift+Tab
          can walk past the overlay into the floating user menu or main
          content, which is exactly the trap the drawer is supposed to be. */}
      <div className={styles['body']} inert={isDrawerOpen}>
        <div className={styles['mobileNavTrigger']}>
          <IconButton icon={<MenuIcon size={20} />} aria-label={openNavLabel} onClick={openDrawer} />
        </div>
        <details className={styles['userMenu']} ref={userMenuRef} data-testid="app-shell-user-menu">
          <summary className={styles['userMenuTrigger']} aria-label={userMenuLabel}>
            <Avatar name={userName || userEmail} size={32} />
            <span className={styles['userName']}>{userName || userEmail}</span>
            <ChevronDownIcon size={16} aria-hidden="true" />
          </summary>
          <div className={styles['userMenuPanel']}>
            <div className={styles['userIdentity']}>
              <strong>{userName || userEmail}</strong><span className="text-caption">{userEmail}</span>
            </div>
            {themeControl}
            <Button variant="ghost" onClick={onLogout} disabled={logoutPending}><LogOutIcon size={18} />{logoutLabel}</Button>
          </div>
        </details>

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
          <button type="button" className={styles['bottomNavItem']} onClick={openDrawer}>
            <MenuIcon size={20} />
            {moreLabel}
          </button>
        </nav>
      </div>
    </div>
  )
}
