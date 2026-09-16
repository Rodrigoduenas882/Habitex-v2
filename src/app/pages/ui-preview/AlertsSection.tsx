import { useTranslation } from 'react-i18next'
import { Alert, type AlertTone } from '@/shared/ui/Alert'
import { Section } from './Section'

const TONES: AlertTone[] = ['info', 'success', 'warning', 'danger']

export function AlertsSection() {
  const { t } = useTranslation('uiPreview')

  return (
    <Section id="alerts" title={t('sections.alerts')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {TONES.map((tone) => (
          <Alert key={tone} tone={tone}>
            {t(`alerts.${tone}`)}
          </Alert>
        ))}
      </div>
    </Section>
  )
}
