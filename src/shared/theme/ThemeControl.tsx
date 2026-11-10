import { useRef, type KeyboardEvent, type ReactNode } from 'react'
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

const ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp'])

/**
 * Light/Dark appearance picker (only visible choice - no "System" button).
 * The OS preference still drives the initial theme whenever the user hasn't
 * made an explicit choice yet (see resolveInitialPreference/useTheme) - this
 * control just doesn't expose that as a third selectable option. Reuses
 * useTheme (the same mechanism as everywhere else theming happens) - purely
 * a client UI preference, persisted to localStorage, never Zustand or
 * TanStack Query.
 *
 * Implements the full WAI-ARIA radiogroup pattern, not just `role="radio"`
 * styling: a single roving tabindex (only the checked option is a Tab stop)
 * plus Left/Right/Up/Down arrow keys to move *and* select between options,
 * wrapping at the ends - matching how native `<input type="radio">` groups
 * behave, since these buttons stand in for one.
 */
export function ThemeControl() {
  const { resolvedTheme, setPreference } = useTheme()
  const { t } = useTranslation('common')
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!ARROW_KEYS.has(event.key)) return
    event.preventDefault()

    const direction = PREVIOUS_KEYS.has(event.key) ? -1 : 1
    const nextIndex = (index + direction + OPTIONS.length) % OPTIONS.length
    const next = OPTIONS[nextIndex]
    if (!next) return

    setPreference(next.value)
    optionRefs.current[nextIndex]?.focus()
  }

  return (
    <div className={styles['group']} role="radiogroup" aria-label={t('theme.groupLabel')}>
      {OPTIONS.map(({ value, Icon }, index) => {
        const isActive = resolvedTheme === value

        return (
          <button
            key={value}
            ref={(node) => {
              optionRefs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={t('theme.selectLabel', { theme: t(`theme.${value}`) })}
            // Roving tabindex: only the checked option is a Tab stop, same as
            // a native radio group - the rest are reachable via arrow keys.
            tabIndex={isActive ? 0 : -1}
            className={cx(styles['option'], isActive && styles['optionActive'])}
            onClick={() => {
              setPreference(value)
            }}
            onKeyDown={(event) => {
              handleKeyDown(event, index)
            }}
          >
            <Icon size={16} />
          </button>
        )
      })}
    </div>
  )
}
