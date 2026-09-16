import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { FileTextIcon } from '@/shared/ui/icons'
import { Section } from './Section'

export function EmptyStateSection() {
  const { t } = useTranslation('uiPreview')

  return (
    <Section id="empty-state" title={t('sections.emptyState')}>
      <Card>
        <EmptyState
          icon={<FileTextIcon size={28} />}
          title={t('emptyState.title')}
          description={t('emptyState.description')}
          action={<Button size="sm">{t('emptyState.action')}</Button>}
        />
      </Card>
    </Section>
  )
}
