import { useTranslation } from 'react-i18next'
import { Card } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/Skeleton'
import styles from './SkeletonSection.module.css'
import { Section } from './Section'

export function SkeletonSection() {
  const { t } = useTranslation('uiPreview')

  return (
    <Section id="skeleton" title={t('sections.skeleton')}>
      <Card>
        {[0, 1, 2].map((row) => (
          <div key={row} className={styles['row']}>
            <Skeleton width={40} height={40} radius="full" />
            <div className={styles['lines']}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={12} />
            </div>
          </div>
        ))}
      </Card>
    </Section>
  )
}
