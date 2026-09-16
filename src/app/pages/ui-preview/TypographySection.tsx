import { useTranslation } from 'react-i18next'
import { Section } from './Section'

const SCALE = [
  { className: 'text-display', token: 'display' },
  { className: 'text-h1', token: 'heading-1' },
  { className: 'text-h2', token: 'heading-2' },
  { className: 'text-h3', token: 'heading-3' },
  { className: 'text-body', token: 'body' },
  { className: 'text-body-sm', token: 'body-small' },
  { className: 'text-label', token: 'label' },
  { className: 'text-caption', token: 'caption' },
] as const

export function TypographySection() {
  const { t } = useTranslation('uiPreview')

  return (
    <Section id="typography" title={t('sections.typography')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {SCALE.map((item) => (
          <div key={item.token}>
            <p className={item.className}>{t('brand.name')}</p>
            <p className="text-caption">{item.token}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="text-label" style={{ marginBottom: 'var(--space-2)' }}>
          tabular-nums
        </p>
        <p className="text-h2 tabular-nums">$3.850.000</p>
      </div>
    </Section>
  )
}
