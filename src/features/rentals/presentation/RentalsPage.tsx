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
import { useCancelDraftRental } from '../application/useCancelDraftRental'
import { useEndRental } from '../application/useEndRental'
import { useRentals } from '../application/useRentals'
import { useRentalTermsExistence } from '../application/useRentalTermsExistence'
import { useStartEndingRental } from '../application/useStartEndingRental'
import {
  activeRelationshipCount,
  type RentalActivationError,
  type RentalLifecycleError,
  type RentalRelationship,
} from '../domain/rental.types'

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
 * A DRAFT rental is ready to activate, from this page's own read-only
 * client-side signals, only when both of activate_rental_relationship's own
 * real checks pass: the 4 schedule columns are set (mirrors
 * RENTAL_TERMS_INCOMPLETE) and a term version already exists for it (mirrors
 * INITIAL_TERM_VERSION_REQUIRED - see useRentalTermsExistence). This is not
 * a heuristic - it reads the exact same signals the RPC itself reads - but
 * it is still only ever a proactive UX gate, never a substitute for the RPC
 * rejecting an actually-invalid activation (see this page's own doc comment
 * below).
 */
function hasCompleteSchedule(rental: RentalRelationship): boolean {
  return (
    rental.realStartDate !== null &&
    rental.trackingStartDate !== null &&
    rental.paymentDay !== null &&
    rental.paymentTiming !== null
  )
}

/**
 * /rentals: lists rental_relationships scoped to the current
 * administration, plus the CTA to /rentals/new (create_rental_draft) and,
 * for DRAFT rows, the "Activar" action (activate_rental_relationship) and
 * the "Completar términos" action (/rentals/:id/terms, see RentalTermsPage).
 * The management-access/capacity/terms-readiness gates here are UX
 * convenience only (see management-access.ts and hasCompleteSchedule's own
 * doc comment) - the RPC called by useActivateRental remains the real,
 * authoritative check regardless of what this page computed locally; a
 * rejection it actually returns is still caught and mapped via
 * activationError/activationErrorRelationshipId exactly as before, whether
 * or not this page's own gate predicted it.
 *
 * Lifecycle completion (INC-009) adds three more per-status actions, same
 * pending/error-tracking pattern as activation: DRAFT rows also get
 * "Cancelar" (cancel_draft_rental, gated by managementGate like
 * create/activate), ACTIVE rows get "Iniciar cierre" (start_ending_rental),
 * ENDING rows get "Terminar arriendo" (end_rental). startEnding/end are
 * deliberately NOT gated by managementGate - the backend itself only
 * requires the management role for those two RPCs, no subscription check,
 * so an owner/manager can still wind down or end an existing rental after
 * subscription access has lapsed (see RentalRepository.startEnding/end's
 * own doc comments). ENDED/CANCELLED rows still get no lifecycle action.
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
  const cancelDraftRental = useCancelDraftRental()
  const startEndingRental = useStartEndingRental()
  const endRental = useEndRental()

  const draftRentalIds = rentals.filter((rental) => rental.status === 'DRAFT').map((rental) => rental.id)
  const termsExistenceQuery = useRentalTermsExistence(administrationId, draftRentalIds)

  const activatingRelationshipId = activateRental.isPending ? activateRental.variables.relationshipId : null
  const activationError = activateRental.isError ? (activateRental.error as RentalActivationError) : null
  const activationErrorRelationshipId = activationError ? (activateRental.variables?.relationshipId ?? null) : null

  const activationBlockReason: RentalActivationBlockReason = managementGate.blocked
    ? 'managementAccess'
    : !hasCapacity
      ? 'capacity'
      : null

  const cancelingRelationshipId = cancelDraftRental.isPending ? cancelDraftRental.variables.relationshipId : null
  const cancelError = cancelDraftRental.isError ? (cancelDraftRental.error as RentalLifecycleError) : null
  const cancelErrorRelationshipId = cancelError ? (cancelDraftRental.variables?.relationshipId ?? null) : null

  const startingEndingRelationshipId = startEndingRental.isPending
    ? startEndingRental.variables.relationshipId
    : null
  const startEndingError = startEndingRental.isError ? (startEndingRental.error as RentalLifecycleError) : null
  const startEndingErrorRelationshipId = startEndingError
    ? (startEndingRental.variables?.relationshipId ?? null)
    : null

  const endingRelationshipId = endRental.isPending ? endRental.variables.relationshipId : null
  const endError = endRental.isError ? (endRental.error as RentalLifecycleError) : null
  const endErrorRelationshipId = endError ? (endRental.variables?.relationshipId ?? null) : null

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
          {rentals.map((rental) => {
            if (rental.status === 'ACTIVE') {
              return (
                <RentalListCard
                  key={rental.id}
                  rental={rental}
                  startEnding={{
                    isPending: startingEndingRelationshipId === rental.id,
                    errorCode:
                      startEndingErrorRelationshipId === rental.id ? (startEndingError?.code ?? null) : null,
                    onStartEnding: () => {
                      startEndingRental.mutate({
                        administrationId: resolvedAdministrationId,
                        relationshipId: rental.id,
                      })
                    },
                  }}
                />
              )
            }

            if (rental.status === 'ENDING') {
              return (
                <RentalListCard
                  key={rental.id}
                  rental={rental}
                  endRental={{
                    isPending: endingRelationshipId === rental.id,
                    errorCode: endErrorRelationshipId === rental.id ? (endError?.code ?? null) : null,
                    onConfirm: () => {
                      endRental.mutate({
                        administrationId: resolvedAdministrationId,
                        relationshipId: rental.id,
                      })
                    },
                  }}
                />
              )
            }

            if (rental.status !== 'DRAFT') {
              return <RentalListCard key={rental.id} rental={rental} />
            }

            // Per-row, unlike managementAccess/capacity above (same for
            // every row): a term version genuinely exists (or doesn't) per
            // relationship. While termsExistenceQuery hasn't resolved yet,
            // this fails open (not blocked for this reason) - same
            // "never flash disabled while state is unknown" principle as
            // useManagementGate - unless the schedule itself is already
            // known to be incomplete, which this page can determine
            // synchronously from data it already has.
            const termsReady =
              hasCompleteSchedule(rental) &&
              (termsExistenceQuery.isPending ? true : (termsExistenceQuery.data?.has(rental.id) ?? false))

            const rowBlockReason: RentalActivationBlockReason =
              activationBlockReason ?? (termsReady ? null : 'termsIncomplete')

            return (
              <RentalListCard
                key={rental.id}
                rental={rental}
                activation={{
                  disabled:
                    managementGate.blocked || !hasCapacity || !termsReady || activatingRelationshipId === rental.id,
                  blockReason: rowBlockReason,
                  isPending: activatingRelationshipId === rental.id,
                  errorCode: activationErrorRelationshipId === rental.id ? (activationError?.code ?? null) : null,
                  onActivate: () => {
                    activateRental.mutate({
                      administrationId: resolvedAdministrationId,
                      relationshipId: rental.id,
                    })
                  },
                }}
                cancelDraft={{
                  disabled: managementGate.blocked || cancelingRelationshipId === rental.id,
                  blockReason: managementGate.blocked ? 'managementAccess' : null,
                  isPending: cancelingRelationshipId === rental.id,
                  errorCode: cancelErrorRelationshipId === rental.id ? (cancelError?.code ?? null) : null,
                  onConfirm: () => {
                    cancelDraftRental.mutate({
                      administrationId: resolvedAdministrationId,
                      relationshipId: rental.id,
                    })
                  },
                }}
              />
            )
          })}
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
