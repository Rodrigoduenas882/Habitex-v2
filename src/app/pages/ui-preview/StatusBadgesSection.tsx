import { useTranslation } from 'react-i18next'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import { Section } from './Section'

const STATUS_TONES: Array<{ statusKey: 'active' | 'pending' | 'paid' | 'overdue' | 'finished'; tone: BadgeTone }> = [
  { statusKey: 'active', tone: 'primary' },
  { statusKey: 'pending', tone: 'warning' },
  { statusKey: 'paid', tone: 'success' },
  { statusKey: 'overdue', tone: 'danger' },
  { statusKey: 'finished', tone: 'neutral' },
]

export function StatusBadgesSection() {
  const { t } = useTranslation(['uiPreview', 'common'])

  return (
    <Section id="status-badges" title={t('uiPreview:sections.statusBadges')}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        {STATUS_TONES.map(({ statusKey, tone }) => (
          <Badge key={statusKey} tone={tone}>
            {t(`common:status.${statusKey}`)}
          </Badge>
        ))}
      </div>
    </Section>
  )
}
