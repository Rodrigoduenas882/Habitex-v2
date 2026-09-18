import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentAdministration } from '@/features/administration/application/useCurrentAdministration'
import { Alert } from '@/shared/ui/Alert'
import { EmptyState } from '@/shared/ui/EmptyState'
import { KeyIcon } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'
import styles from './RentalsPage.module.css'
import { RentalListCard } from './RentalListCard'
import { useRentals } from '../application/useRentals'

function RentalsGridSkeleton() {
  return (
    <div className={styles['grid']} data-testid="rentals-loading" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} height={196} radius="lg" />
      ))}
    </div>
  )
}

/**
 * /rentals: first real read-only vertical of the Arriendos module. Lists
 * rental_relationships scoped to the current administration - nothing
 * about the arrendable subject, tenant or economics yet (those live in
 * separate tables not read by this increment; see RentalRelationship's own
 * doc comment). No creation, no CTA to a route that doesn't exist yet.
 */
export default function RentalsPage() {
  const { t } = useTranslation('rentals')
  const currentAdministration = useCurrentAdministration()
  const administrationId =
    currentAdministration.status === 'resolved' ? currentAdministration.administration.id : undefined
  const rentalsQuery = useRentals(administrationId)

  let content: ReactNode

  if (
    currentAdministration.status === 'loading' ||
    (currentAdministration.status === 'resolved' && rentalsQuery.isLoading)
  ) {
    content = <RentalsGridSkeleton />
  } else if (currentAdministration.status === 'error') {
    content = (
      <Alert tone="danger" title={t('errors.administrationTitle')}>
        {t('errors.administrationDescription')}
      </Alert>
    )
  } else if (currentAdministration.status === 'none') {
    content = (
      <EmptyState
        icon={<KeyIcon size={24} />}
        title={t('noAdministration.title')}
        description={t('noAdministration.description')}
      />
    )
  } else if (currentAdministration.status === 'selection-required') {
    content = (
      <EmptyState
        icon={<KeyIcon size={24} />}
        title={t('selectionRequired.title')}
        description={t('selectionRequired.description')}
      />
    )
  } else if (rentalsQuery.isError) {
    content = (
      <Alert tone="danger" title={t('errors.rentalsTitle')}>
        {t('errors.rentalsDescription')}
      </Alert>
    )
  } else {
    const rentals = rentalsQuery.data ?? []
    content =
      rentals.length === 0 ? (
        <EmptyState icon={<KeyIcon size={24} />} title={t('empty.title')} description={t('empty.description')} />
      ) : (
        <div className={styles['grid']}>
          {rentals.map((rental) => (
            <RentalListCard key={rental.id} rental={rental} />
          ))}
        </div>
      )
  }

  return (
    <div className={styles['page']}>
      <h1 className="text-h2">{t('title')}</h1>
      {content}
    </div>
  )
}
