import { useTranslation } from 'react-i18next'
import { BrandMark } from '@/shared/ui/BrandMark'
import styles from './BrandSection.module.css'
import { Section } from './Section'

export function BrandSection() {
  const { t } = useTranslation('uiPreview')

  return (
    <Section id="brand" title={t('sections.brand')}>
      <div className={styles['brand']}>
        <BrandMark size={48} />
        <div>
          <p className="text-h1">{t('brand.name')}</p>
          <p className="text-body text-muted">{t('brand.tagline')}</p>
        </div>
      </div>
    </Section>
  )
}
