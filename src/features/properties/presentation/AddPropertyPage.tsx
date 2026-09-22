import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useActiveAdministration } from '@/features/administration/application/useActiveAdministration'
import { AdministrationPicker } from '@/features/administration/presentation/AdministrationPicker'
import { ParkingForm } from '@/features/parking/presentation/ParkingForm'
import { Alert } from '@/shared/ui/Alert'
import { EmptyState } from '@/shared/ui/EmptyState'
import { BuildingIcon } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'
import { AddFullPropertyForm } from './AddFullPropertyForm'
import styles from './AddPropertyPage.module.css'
import { AddRoomRentalPropertyForm } from './AddRoomRentalPropertyForm'
import { PropertyTypeSelector, type PropertyAddOption } from './PropertyTypeSelector'

/**
 * /properties/new - starts with "¿Qué quieres administrar?" and then shows
 * the form for the chosen option. A single page with internal wizard state
 * (not per-option routes) - this is a short, one-shot session, nothing here
 * needs to be deep-linkable or resumable (unlike room setup, which does).
 */
export default function AddPropertyPage() {
  const { t } = useTranslation('properties')
  const currentAdministration = useActiveAdministration()
  const [selection, setSelection] = useState<PropertyAddOption | null>(null)

  if (currentAdministration.status === 'loading') {
    return (
      <div className={styles['page']} data-testid="add-property-loading">
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
          icon={<BuildingIcon size={24} />}
          title={t('noAdministration.title')}
          description={t('noAdministration.description')}
        />
      </div>
    )
  }

  if (currentAdministration.status === 'selection-required') {
    return (
      <div className={styles['page']}>
        <AdministrationPicker
          options={currentAdministration.options}
          onSelect={currentAdministration.select}
        />
      </div>
    )
  }

  const administrationId = currentAdministration.administration.id

  if (selection === 'full') {
    return (
      <AddFullPropertyForm
        administrationId={administrationId}
        onBack={() => {
          setSelection(null)
        }}
      />
    )
  }

  if (selection === 'rooms') {
    return (
      <AddRoomRentalPropertyForm
        administrationId={administrationId}
        onBack={() => {
          setSelection(null)
        }}
      />
    )
  }

  if (selection === 'parking') {
    return (
      <ParkingForm
        administrationId={administrationId}
        onBack={() => {
          setSelection(null)
        }}
      />
    )
  }

  return (
    <div className={styles['page']}>
      <h1 className="text-h2">{t('addProperty.title')}</h1>
      <PropertyTypeSelector onSelect={setSelection} />
    </div>
  )
}
