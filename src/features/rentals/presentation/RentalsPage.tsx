import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useActiveAdministration } from '@/features/administration/application/useActiveAdministration'
import { useManagementGate } from '@/features/administration/application/useManagementGate'
import { hasRelationshipCapacity } from '@/features/administration/domain/management-access'
import { AdministrationPicker } from '@/features/administration/presentation/AdministrationPicker'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { KeyIcon } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'
import styles from './RentalsPage.module.css'
import { RentalListCard, type RentalActivationBlockReason } from './RentalListCard'
import { useActivateRental } from '../application/useActivateRental'
import { useRentals } from '../application/useRentals'
import { activeRelationshipCount, type RentalActivationError } from '../domain/rental.types'

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
 * /rentals: lists rental_relationships scoped to the current
 * administration, plus the CTA to /rentals/new (create_rental_draft) and,
 * for DRAFT rows, the "Activar" action (activate_rental_relationship). The
 * management-access/capacity gate here is UX convenience only (see
 * management-access.ts) - the RPC called by useActivateRental remains the
 * real, authoritative check regardless of what this page computed locally.
 * Nothing about term versions, dates, canon, services, contract, occupancy
 * or payments yet - those stay out of scope until later increments.
 */
export default function RentalsPage() {
  const { t } = useTranslation('rentals')
  const navigate = useNavigate()
  const currentAdministration = useActiveAdministration()
  const administrationId =
    currentAdministration.status === 'resolved' ? currentAdministration.administration.id : undefined
  const rentalsQuery = useRentals(administrationId)
  const rentals = rentalsQuery.data ?? []

  const managementGate = useManagementGate(administrationId)
  const hasCapacity = hasRelationshipCapacity(managementGate.subscription ?? null, activeRelationshipCount(rentals))
  const activateRental = useActivateRental()

  const activatingRelationshipId = activateRental.isPending ? activateRental.variables.relationshipId : null
  const activationError = activateRental.isError ? (activateRental.error as RentalActivationError) : null
  const activationErrorRelationshipId = activationError ? (activateRental.variables?.relationshipId ?? null) : null

  const activationBlockReason: RentalActivationBlockReason = managementGate.blocked
    ? 'managementAccess'
    : !hasCapacity
      ? 'capacity'
      : null

  const addRentalCta = (
    <Button
      onClick={() => {
        void navigate('/rentals/new')
      }}
    >
      {t('addRental.cta')}
    </Button>
  )

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
      <AdministrationPicker
        options={currentAdministration.options}
        onSelect={currentAdministration.select}
      />
    )
  } else if (rentalsQuery.isError) {
    content = (
      <Alert tone="danger" title={t('errors.rentalsTitle')}>
        {t('errors.rentalsDescription')}
      </Alert>
    )
  } else {
    // Only 'resolved' can remain here - every other ActiveAdministrationState
    // status was already handled by an earlier branch above.
    const resolvedAdministrationId = currentAdministration.administration.id
    content =
      rentals.length === 0 ? (
        <EmptyState
          icon={<KeyIcon size={24} />}
          title={t('empty.title')}
          description={t('empty.description')}
          action={addRentalCta}
        />
      ) : (
        <div className={styles['grid']}>
          {rentals.map((rental) => (
            <RentalListCard
              key={rental.id}
              rental={rental}
              {...(rental.status === 'DRAFT'
                ? {
                    activation: {
                      disabled:
                        managementGate.blocked || !hasCapacity || activatingRelationshipId === rental.id,
                      blockReason: activationBlockReason,
                      isPending: activatingRelationshipId === rental.id,
                      errorCode:
                        activationErrorRelationshipId === rental.id ? (activationError?.code ?? null) : null,
                      onActivate: () => {
                        activateRental.mutate({
                          administrationId: resolvedAdministrationId,
                          relationshipId: rental.id,
                        })
                      },
                    },
                  }
                : {})}
            />
          ))}
        </div>
      )
  }

  return (
    <div className={styles['page']}>
      <div className={styles['header']}>
        <h1 className="text-h2">{t('title')}</h1>
        {currentAdministration.status === 'resolved' ? addRentalCta : null}
      </div>
      {content}
    </div>
  )
}
