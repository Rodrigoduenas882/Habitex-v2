import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useCurrentAdministration } from '@/features/administration/application/useCurrentAdministration'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { BuildingIcon } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'
import styles from './PropertiesPage.module.css'
import { PropertyListCard } from './PropertyListCard'
import { useProperties } from '../application/useProperties'

function PropertiesGridSkeleton() {
  return (
    <div className={styles['grid']} data-testid="properties-loading" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} height={196} radius="lg" />
      ))}
    </div>
  )
}

/**
 * First real Properties screen: a read-only list scoped to the current
 * administration, plus the real "Agregar inmueble" CTA -> /properties/new.
 * The CTA only renders once an administration is actually resolved -
 * creation can't operate otherwise (see useCurrentAdministration).
 */
export default function PropertiesPage() {
  const { t } = useTranslation('properties')
  const navigate = useNavigate()
  const currentAdministration = useCurrentAdministration()
  const administrationId =
    currentAdministration.status === 'resolved' ? currentAdministration.administration.id : undefined
  const propertiesQuery = useProperties(administrationId)

  const addPropertyCta = (
    <Button
      onClick={() => {
        void navigate('/properties/new')
      }}
    >
      {t('addProperty.cta')}
    </Button>
  )

  let content: ReactNode

  if (
    currentAdministration.status === 'loading' ||
    (currentAdministration.status === 'resolved' && propertiesQuery.isLoading)
  ) {
    content = <PropertiesGridSkeleton />
  } else if (currentAdministration.status === 'error') {
    content = (
      <Alert tone="danger" title={t('errors.administrationTitle')}>
        {t('errors.administrationDescription')}
      </Alert>
    )
  } else if (currentAdministration.status === 'none') {
    content = (
      <EmptyState
        icon={<BuildingIcon size={24} />}
        title={t('noAdministration.title')}
        description={t('noAdministration.description')}
      />
    )
  } else if (currentAdministration.status === 'selection-required') {
    content = (
      <EmptyState
        icon={<BuildingIcon size={24} />}
        title={t('selectionRequired.title')}
        description={t('selectionRequired.description')}
      />
    )
  } else if (propertiesQuery.isError) {
    content = (
      <Alert tone="danger" title={t('errors.propertiesTitle')}>
        {t('errors.propertiesDescription')}
      </Alert>
    )
  } else {
    const properties = propertiesQuery.data ?? []
    content =
      properties.length === 0 ? (
        <EmptyState
          icon={<BuildingIcon size={24} />}
          title={t('empty.title')}
          description={t('empty.description')}
        />
      ) : (
        <div className={styles['grid']}>
          {properties.map((property) => (
            <PropertyListCard key={property.id} property={property} />
          ))}
        </div>
      )
  }

  return (
    <div className={styles['page']}>
      <div className={styles['header']}>
        <h1 className="text-h2">{t('title')}</h1>
        {currentAdministration.status === 'resolved' ? addPropertyCta : null}
      </div>
      {content}
    </div>
  )
}
