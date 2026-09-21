import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentAdministration } from '@/features/administration/application/useCurrentAdministration'
import { Alert } from '@/shared/ui/Alert'
import { EmptyState } from '@/shared/ui/EmptyState'
import { KeyIcon } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'
import { AddRentalDraftForm } from './AddRentalDraftForm'
import styles from './AddRentalPage.module.css'
import { RentalSubjectTypeSelector } from './RentalSubjectTypeSelector'
import type { RentalSubjectType } from '../domain/rental-subject.types'

/**
 * /rentals/new - starts with "¿Qué vas a arrendar?" (no backend write at
 * all yet) and only shows the subject/tenant form once a category is
 * chosen. A single page with internal wizard state (not per-step routes),
 * same pattern as AddPropertyPage - this is a short, one-shot session.
 * Nothing is written to the backend until Continuar is pressed inside
 * AddRentalDraftForm.
 */
export default function AddRentalPage() {
  const { t } = useTranslation('rentals')
  const currentAdministration = useCurrentAdministration()
  const [subjectType, setSubjectType] = useState<RentalSubjectType | null>(null)

  if (currentAdministration.status === 'loading') {
    return (
      <div className={styles['page']} data-testid="add-rental-loading">
        <Skeleton height={32} width={240} />
        <Skeleton height={196} radius="lg" />
      </div>
    )
  }

  if (currentAdministration.status === 'error') {
    return (
      <div className={styles['page']}>
        <Alert tone="danger" title={t('errors.administrationTitle')}>
          {t('errors.administrationDescription')}
        </Alert>
      </div>
    )
  }

  if (currentAdministration.status === 'none') {
    return (
      <div className={styles['page']}>
        <EmptyState
          icon={<KeyIcon size={24} />}
          title={t('noAdministration.title')}
          description={t('noAdministration.description')}
        />
      </div>
    )
  }

  if (currentAdministration.status === 'selection-required') {
    return (
      <div className={styles['page']}>
        <EmptyState
          icon={<KeyIcon size={24} />}
          title={t('selectionRequired.title')}
          description={t('selectionRequired.description')}
        />
      </div>
    )
  }

  const administrationId = currentAdministration.administration.id

  if (subjectType !== null) {
    return (
      <AddRentalDraftForm
        administrationId={administrationId}
        subjectType={subjectType}
        onBack={() => {
          setSubjectType(null)
        }}
      />
    )
  }

  return (
    <div className={styles['page']}>
      <h1 className="text-h2">{t('addRental.title')}</h1>
      <RentalSubjectTypeSelector onSelect={setSubjectType} />
    </div>
  )
}
