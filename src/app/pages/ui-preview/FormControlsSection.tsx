import { useTranslation } from 'react-i18next'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Textarea } from '@/shared/ui/Textarea'
import styles from './FormControlsSection.module.css'
import { Section } from './Section'

export function FormControlsSection() {
  const { t } = useTranslation('uiPreview')

  return (
    <Section id="form-controls" title={t('sections.formControls')}>
      <div className={styles['grid']}>
        <Input label={t('form.nameLabel')} placeholder={t('form.namePlaceholder')} />
        <Input
          label={t('form.emailLabel')}
          type="email"
          defaultValue="camila@"
          error={t('form.emailError')}
        />
        <Input label={t('form.nameLabel')} defaultValue={t('example.propertyRowTitle')} disabled />
        <Select label={t('form.propertyLabel')} hint={t('form.propertyHint')} defaultValue="">
          <option value="" disabled>
            {t('form.propertyLabel')}
          </option>
          <option value="apt-302">{t('example.apartment302')}</option>
          <option value="room-2">{t('example.room2')}</option>
          <option value="casa-14">{t('example.propertyRowTitle')}</option>
        </Select>
        <Textarea label={t('form.notesLabel')} placeholder={t('form.notesPlaceholder')} />
      </div>
    </Section>
  )
}
