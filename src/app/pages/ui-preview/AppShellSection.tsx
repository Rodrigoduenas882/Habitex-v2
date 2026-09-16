import { useTranslation } from 'react-i18next'
import { AppShellPreview } from './AppShellPreview'
import { HabitexExampleContent } from './HabitexExampleContent'
import { Section } from './Section'

export function AppShellSection() {
  const { t } = useTranslation('uiPreview')

  return (
    <Section id="app-shell" title={t('sections.appShell')} description={t('sections.example')}>
      <AppShellPreview>
        <HabitexExampleContent />
      </AppShellPreview>
    </Section>
  )
}
