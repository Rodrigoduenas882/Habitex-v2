import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/Button'
import { CloseIcon, SettingsIcon } from '@/shared/ui/icons'
import { IconButton } from '@/shared/ui/IconButton'
import { Section } from './Section'

export function ButtonsSection() {
  const { t } = useTranslation('uiPreview')
  const [loading, setLoading] = useState(false)

  return (
    <Section id="buttons" title={t('sections.buttons')}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <Button variant="primary">{t('buttons.primary')}</Button>
        <Button variant="secondary">{t('buttons.secondary')}</Button>
        <Button variant="ghost">{t('buttons.ghost')}</Button>
        <Button variant="destructive">{t('buttons.destructive')}</Button>
        <Button variant="primary" disabled>
          {t('buttons.primary')}
        </Button>
        <Button
          variant="primary"
          loading={loading}
          onClick={() => {
            setLoading(true)
            window.setTimeout(() => {
              setLoading(false)
            }, 1500)
          }}
        >
          {t('buttons.loading')}
        </Button>
        <IconButton icon={<SettingsIcon size={18} />} aria-label={t('nav.settings')} />
        <IconButton
          icon={<CloseIcon size={18} />}
          aria-label={t('topbar.closeNav')}
          variant="secondary"
        />
      </div>
    </Section>
  )
}
