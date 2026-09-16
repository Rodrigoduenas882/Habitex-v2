import { useTranslation } from 'react-i18next'
import { Card } from '@/shared/ui/Card'
import { Tabs } from '@/shared/ui/Tabs'
import styles from './CardsSection.module.css'
import { Section } from './Section'

export function CardsSection() {
  const { t } = useTranslation('uiPreview')

  return (
    <Section id="cards" title={t('sections.cards')}>
      <div className={styles['grid']}>
        <Card>
          <p className="text-h3">{t('example.propertyRowTitle')}</p>
          <p className="text-body-sm text-muted" style={{ marginTop: 'var(--space-1)' }}>
            {t('example.propertyRowSubtitle')}
          </p>
        </Card>

        <Card interactive>
          <Tabs
            ariaLabel={t('sections.cards')}
            items={[
              {
                value: 'summary',
                label: t('tabs.summary'),
                content: <p className="text-body-sm text-muted">{t('tabs.summaryContent')}</p>,
              },
              {
                value: 'activity',
                label: t('tabs.activity'),
                content: <p className="text-body-sm text-muted">{t('tabs.activityContent')}</p>,
              },
            ]}
          />
        </Card>
      </div>
    </Section>
  )
}
