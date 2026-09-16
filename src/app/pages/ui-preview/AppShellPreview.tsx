import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { Avatar } from '@/shared/ui/Avatar'
import {
  BellIcon,
  BuildingIcon,
  CloseIcon,
  FileTextIcon,
  HomeIcon,
  KeyIcon,
  MenuIcon,
  SettingsIcon,
  UsersIcon,
  WalletIcon,
  type IconProps,
} from '@/shared/ui/icons'
import { IconButton } from '@/shared/ui/IconButton'
import styles from './AppShellPreview.module.css'
import { uiPreviewMockData } from './mock-data'

type NavKey = 'home' | 'rentals' | 'properties' | 'people' | 'finances' | 'documents'

const NAV_ITEMS: Array<{ key: NavKey; icon: (props: IconProps) => ReactNode }> = [
  { key: 'home', icon: HomeIcon },
  { key: 'rentals', icon: KeyIcon },
  { key: 'properties', icon: BuildingIcon },
  { key: 'people', icon: UsersIcon },
  { key: 'finances', icon: WalletIcon },
  { key: 'documents', icon: FileTextIcon },
]

const BOTTOM_NAV_KEYS: NavKey[] = ['home', 'rentals', 'properties', 'finances']
const ACTIVE_ITEM: NavKey = 'home'

export interface AppShellPreviewProps {
  children: ReactNode
}

/**
 * A visual-only mock of the future Habitex shell: no routing, no real
 * navigation state. It exists purely to evaluate the design language.
 */
export function AppShellPreview({ children }: AppShellPreviewProps) {
  const { t } = useTranslation('uiPreview')
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

  const navList = (onNavigate?: () => void) => (
    <nav className={styles['nav']}>
      {NAV_ITEMS.map(({ key, icon: Icon }) => (
        <button
          key={key}
          type="button"
          className={cx(styles['navItem'], key === ACTIVE_ITEM && styles['navItemActive'])}
          aria-current={key === ACTIVE_ITEM ? 'page' : undefined}
          onClick={onNavigate}
        >
          <Icon size={18} />
          {t(`nav.${key}`)}
        </button>
      ))}
      <div className={styles['navDivider']} />
      <button type="button" className={styles['navItem']} onClick={onNavigate}>
        <SettingsIcon size={18} />
        {t('nav.settings')}
      </button>
    </nav>
  )

  return (
    <div className={styles['shell']}>
      <aside className={styles['sidebar']}>
        <div className={cx(styles['brand'], styles['sidebarBrand'])}>
          <span className={styles['brandMark']} aria-hidden="true" />
          <span className={styles['brandName']}>{t('brand.name')}</span>
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
            <span className={styles['brandMark']} aria-hidden="true" />
            <span className={styles['brandName']}>{t('brand.name')}</span>
          </div>
          <IconButton
            icon={<CloseIcon size={18} />}
            aria-label={t('topbar.closeNav')}
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
        <header className={styles['topbar']}>
          <div className={styles['topbarStart']}>
            <IconButton
              icon={<MenuIcon size={20} />}
              aria-label={t('topbar.openNav')}
              className={styles['menuButton']}
              onClick={() => {
                setDrawerOpen(true)
              }}
            />
            <div className={styles['administration']}>
              <span className={styles['administrationLabel']}>
                {t('topbar.currentAdministration')}
              </span>
              <span className={styles['administrationName']}>
                {t('topbar.administrationName')}
              </span>
            </div>
          </div>
          <div className={styles['topbarEnd']}>
            <IconButton
              icon={
                <>
                  <BellIcon size={18} />
                  <span className={styles['notificationDot']} aria-hidden="true" />
                </>
              }
              aria-label={t('topbar.notifications')}
              className={styles['notificationButton']}
            />
            <Avatar name={uiPreviewMockData.userName} size={32} />
          </div>
        </header>

        <main className={styles['main']}>{children}</main>

        <nav className={styles['bottomNav']} aria-label={t('brand.name')}>
          {BOTTOM_NAV_KEYS.map((key) => {
            const item = NAV_ITEMS.find((navItem) => navItem.key === key)
            if (!item) return null
            const Icon = item.icon

            return (
              <button
                key={key}
                type="button"
                className={cx(
                  styles['bottomNavItem'],
                  key === ACTIVE_ITEM && styles['bottomNavItemActive'],
                )}
                aria-current={key === ACTIVE_ITEM ? 'page' : undefined}
              >
                <Icon size={20} />
                {t(`nav.${key}`)}
              </button>
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
            {t('nav.more')}
          </button>
        </nav>
      </div>
    </div>
  )
}
