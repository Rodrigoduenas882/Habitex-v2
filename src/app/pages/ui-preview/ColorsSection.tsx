import { useTranslation } from 'react-i18next'
import { ColorSwatchGrid, type ColorToken } from './ColorSwatch'
import { Section } from './Section'

const PRIMARY_TOKENS: ColorToken[] = [
  { name: 'primary', cssVar: '--color-primary' },
  { name: 'primary-hover', cssVar: '--color-primary-hover' },
  { name: 'primary-subtle', cssVar: '--color-primary-subtle' },
  { name: 'primary-foreground', cssVar: '--color-primary-foreground' },
]

const NEUTRAL_TOKENS: ColorToken[] = [
  { name: 'background', cssVar: '--color-background' },
  { name: 'surface', cssVar: '--color-surface' },
  { name: 'surface-hover', cssVar: '--color-surface-hover' },
  { name: 'foreground', cssVar: '--color-foreground' },
  { name: 'muted', cssVar: '--color-muted' },
  { name: 'border', cssVar: '--color-border' },
]

const SEMANTIC_TOKENS: ColorToken[] = [
  { name: 'success', cssVar: '--color-success' },
  { name: 'success-subtle', cssVar: '--color-success-subtle' },
  { name: 'warning', cssVar: '--color-warning' },
  { name: 'warning-subtle', cssVar: '--color-warning-subtle' },
  { name: 'danger', cssVar: '--color-danger' },
  { name: 'danger-subtle', cssVar: '--color-danger-subtle' },
  { name: 'info', cssVar: '--color-info' },
  { name: 'info-subtle', cssVar: '--color-info-subtle' },
]

export function ColorsSection() {
  const { t } = useTranslation('uiPreview')

  return (
    <Section id="colors" title={t('sections.colors')}>
      <div>
        <p className="text-label" style={{ marginBottom: 'var(--space-3)' }}>
          {t('colors.primary')}
        </p>
        <ColorSwatchGrid tokens={PRIMARY_TOKENS} />
      </div>
      <div>
        <p className="text-label" style={{ marginBottom: 'var(--space-3)' }}>
          {t('colors.neutrals')}
        </p>
        <ColorSwatchGrid tokens={NEUTRAL_TOKENS} />
      </div>
      <div>
        <p className="text-label" style={{ marginBottom: 'var(--space-3)' }}>
          {t('colors.semantic')}
        </p>
        <ColorSwatchGrid tokens={SEMANTIC_TOKENS} />
      </div>
    </Section>
  )
}
