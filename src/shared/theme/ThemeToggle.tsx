import { useTranslation } from 'react-i18next'
import { MoonIcon, SunIcon } from '@/shared/ui/icons'
import styles from './ThemeToggle.module.css'
import { useTheme } from './useTheme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation('common')

  const isDark = theme === 'dark'
  const nextThemeLabel = t(isDark ? 'theme.light' : 'theme.dark')

  return (
    <button
      type="button"
      className={styles['toggle']}
      onClick={toggleTheme}
      aria-label={t('theme.toggleLabel', { theme: nextThemeLabel })}
    >
      {isDark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
      <span className={styles['label']}>{isDark ? t('theme.light') : t('theme.dark')}</span>
    </button>
  )
}
