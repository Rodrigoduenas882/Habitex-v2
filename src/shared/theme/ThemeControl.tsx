import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { MoonIcon, SunIcon, type IconProps } from '@/shared/ui/icons'
import styles from './ThemeControl.module.css'
import type { Theme } from './theme'
import { useTheme } from './useTheme'

const OPTIONS: Array<{ value: Theme; Icon: (props: IconProps) => ReactNode }> = [
  { value: 'light', Icon: SunIcon },
  { value: 'dark', Icon: MoonIcon },
]

/**
 * Light/Dark appearance picker (only visible choice - no "System" button).
 * The OS preference still drives the initial theme whenever the user hasn't
 * made an explicit choice yet (see resolveInitialPreference/useTheme) - this
 * control just doesn't expose that as a third selectable option. Reuses
 * useTheme (the same mechanism as everywhere else theming happens) - purely
 * a client UI preference, persisted to localStorage, never Zustand or
 * TanStack Query.
 */
export function ThemeControl() {
  const { resolvedTheme, setPreference } = useTheme()
  const { t } = useTranslation('common')

  return (
    <div className={styles['group']} role="radiogroup" aria-label={t('theme.groupLabel')}>
      {OPTIONS.map(({ value, Icon }) => {
        const isActive = resolvedTheme === value

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={t('theme.selectLabel', { theme: t(`theme.${value}`) })}
            className={cx(styles['option'], isActive && styles['optionActive'])}
            onClick={() => {
              setPreference(value)
            }}
          >
            <Icon size={16} />
          </button>
        )
      })}
    </div>
  )
}
