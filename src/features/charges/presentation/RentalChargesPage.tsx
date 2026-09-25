import { useTranslation, type UseTranslationResponse } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useActiveAdministration } from '@/features/administration/application/useActiveAdministration'
import { useManagementGate } from '@/features/administration/application/useManagementGate'
import { AdministrationPicker } from '@/features/administration/presentation/AdministrationPicker'
import { useRentals } from '@/features/rentals/application/useRentals'
import { cx } from '@/shared/lib/cx'
import { Alert } from '@/shared/ui/Alert'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { WalletIcon } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'
import styles from './RentalChargesPage.module.css'
import { useCharges } from '../application/useCharges'
import { useGenerateRentCharges } from '../application/useGenerateRentCharges'
import { ChargeRepositoryError, type Charge, type ChargeFinancialStatus } from '../domain/charge.types'

type ChargesT = UseTranslationResponse<['charges', 'administration'], undefined>['t']

/**
 * Existing semantic tones only (see DESIGN.md), same principle as
 * RentalListCard's/RentalContractsPage's own STATUS_TONE. PAID is the one
 * unambiguously positive state; OVERDUE is the one closest to a problem;
 * PARTIAL is "something to pay attention to"; PENDING is a plain, non-urgent
 * state.
 */
const STATUS_TONE: Record<ChargeFinancialStatus, BadgeTone> = {
  PAID: 'success',
  OVERDUE: 'danger',
  PARTIAL: 'warning',
  PENDING: 'neutral',
}

function formatDate(value: string): string {
  // Stored as a plain date (no time/zone) - parsed at local midnight so it
  // never shifts a day depending on the viewer's timezone (same pattern as
  // RentalListCard's own formatDate).
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`),
  )
}

/** Plain Intl.NumberFormat('es-CO'), no currency selector or decimals - COP
 * is the only currency this frontend ever displays, same pattern as
 * FinancialOverview's own formatCurrency. */
function formatAmount(value: number): string {
  return `$${new Intl.NumberFormat('es-CO').format(value)}`
}

/** Maps a caught mutation error to the specific mapped copy for its
 * ChargeErrorCode, or the generic 'unknown' fallback for anything else. */
function generateErrorMessage(t: ChargesT, error: unknown): string {
  const code = error instanceof ChargeRepositoryError ? error.code : 'unknown'
  return t(`generate.errors.${code}`)
}

interface ChargeCardProps {
  charge: Charge
}

/** One read-only charge row: type, description, period (when present), due
 * date, amount/paid/balance (all `.tabular-nums` per DESIGN.md §4) and a
 * Badge for financial_status. No edit/delete/void action anywhere - charges
 * are strictly read-only in this increment (see this feature's own scope
 * notes). */
function ChargeCard({ charge }: ChargeCardProps) {
  const { t } = useTranslation('charges')

  return (
    <Card className={styles['chargeCard']}>
      <div className={styles['chargeHeader']}>
        <Badge tone={STATUS_TONE[charge.financialStatus]}>{t(`financialStatus.${charge.financialStatus}`)}</Badge>
        <span className="text-caption text-muted">{t(`type.${charge.chargeType}`)}</span>
      </div>
      <p className="text-body-sm">{charge.description}</p>
      {charge.periodStart && charge.periodEnd ? (
        <p className="text-caption text-muted">
          {t('list.period', { start: formatDate(charge.periodStart), end: formatDate(charge.periodEnd) })}
        </p>
      ) : null}
      <p className="text-caption text-muted">{t('list.dueDate', { date: formatDate(charge.dueDate) })}</p>
      <div className={styles['amounts']}>
        <p className={cx('text-body-sm', 'tabular-nums')}>
          {t('list.amount', { amount: formatAmount(charge.amount) })}
        </p>
        <p className={cx('text-body-sm', 'tabular-nums')}>
          {t('list.paidAmount', { amount: formatAmount(charge.paidAmount) })}
        </p>
        <p className={cx('text-body-sm', 'tabular-nums')}>
          {t('list.balance', { amount: formatAmount(charge.balance) })}
        </p>
      </div>
    </Card>
  )
}

interface GenerateRentChargesActionProps {
  administrationId: string
  relationshipId: string
  managementBlocked: boolean
}

/**
 * "Generar cargos de renta" (generate_rent_charges). Gated by
 * useManagementGate exactly like every other mutating action in
 * features/contracts/ and features/rentals/ - disabled with a visible
 * reason when blocked, but never hides anything else on the page (the
 * charge list itself stays visible regardless, see RentalChargesView's own
 * doc comment). The button is disabled while the mutation is pending, to
 * prevent a duplicate submission. On success, distinguishes createdCount > 0
 * ("N cargo(s) generado(s)") from createdCount === 0 ("no había cargos
 * nuevos por generar") - both are successful outcomes, never an error (the
 * RPC is idempotent - see ChargeRepository.generateRentCharges's own doc
 * comment).
 */
function GenerateRentChargesAction({ administrationId, relationshipId, managementBlocked }: GenerateRentChargesActionProps) {
  const { t } = useTranslation(['charges', 'administration'])
  const generateRentCharges = useGenerateRentCharges()

  const isForThisRelationship = generateRentCharges.variables?.rentalRelationshipId === relationshipId

  const successMessage =
    generateRentCharges.isSuccess && isForThisRelationship
      ? generateRentCharges.data.createdCount > 0
        ? t('generate.success.created', { count: generateRentCharges.data.createdCount })
        : t('generate.success.none')
      : null

  const errorMessage =
    generateRentCharges.isError && isForThisRelationship ? generateErrorMessage(t, generateRentCharges.error) : null

  return (
    <div className={styles['generateRow']}>
      <Button
        type="button"
        loading={generateRentCharges.isPending}
        disabled={managementBlocked || generateRentCharges.isPending}
        aria-disabled={managementBlocked ? 'true' : undefined}
        onClick={() => {
          generateRentCharges.mutate({ administrationId, rentalRelationshipId: relationshipId })
        }}
      >
        {generateRentCharges.isPending ? t('generate.submitting') : t('generate.cta')}
      </Button>
      {managementBlocked ? (
        <p className="text-caption text-muted">{t('administration:managementAccessGate.blocked')}</p>
      ) : null}
      {successMessage ? <Alert tone="success">{successMessage}</Alert> : null}
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
    </div>
  )
}

export interface RentalChargesViewProps {
  administrationId: string
  relationshipId: string
}

/**
 * The real page body, mounted only once administrationId is resolved (same
 * split as RentalContractsPage/RentalTermsPage). Resolves the relationship
 * from the already-fetched administration rentals list (no getById - same
 * reasoning as RentalContractsPage) and reads this relationship's charges.
 *
 * "Generar cargos de renta" only renders while relationship.status is
 * ACTIVE, ENDING or ENDED - a product-UX visibility rule, not authorization
 * (generate_rent_charges itself only checks can_manage_administration() and
 * status; RLS/RPC status semantics are separate from this page's own
 * visibility choice). DRAFT/CANCELLED never show it.
 *
 * The charge list stays fully visible/readable regardless of status or
 * expired management access - charges_select RLS only requires
 * can_view_relationship(), not management access, so this page never hides
 * read-only financial history behind that gate; only the generate action is
 * gated by useManagementGate below.
 */
function RentalChargesView({ administrationId, relationshipId }: RentalChargesViewProps) {
  const { t } = useTranslation(['charges', 'administration'])
  const rentalsQuery = useRentals(administrationId)
  const chargesQuery = useCharges(administrationId, relationshipId)
  const managementGate = useManagementGate(administrationId)

  if (rentalsQuery.isLoading || chargesQuery.isLoading) {
    return (
      <div className={styles['page']} data-testid="rental-charges-loading">
        <Skeleton height={32} width={240} />
        <Skeleton height={120} radius="lg" />
        <Skeleton height={120} radius="lg" />
      </div>
    )
  }

  if (rentalsQuery.isError || chargesQuery.isError) {
    return (
      <div className={styles['page']}>
        <Alert tone="danger" title={t('errors.chargesTitle')}>
          {t('errors.chargesDescription')}
        </Alert>
      </div>
    )
  }

  const relationship = (rentalsQuery.data ?? []).find((rental) => rental.id === relationshipId) ?? null

  if (!relationship) {
    return (
      <div className={styles['page']}>
        <Alert tone="danger">{t('errors.relationshipNotFound')}</Alert>
      </div>
    )
  }

  const charges = chargesQuery.data ?? []
  const canGenerate =
    relationship.status === 'ACTIVE' || relationship.status === 'ENDING' || relationship.status === 'ENDED'

  return (
    <div className={styles['page']}>
      <h1 className="text-h2">{t('title')}</h1>
      <p className="text-body-sm text-muted">{t('description')}</p>

      {canGenerate ? (
        <GenerateRentChargesAction
          administrationId={administrationId}
          relationshipId={relationshipId}
          managementBlocked={managementGate.blocked}
        />
      ) : null}

      {charges.length === 0 ? (
        <EmptyState icon={<WalletIcon size={24} />} title={t('empty.title')} description={t('empty.description')} />
      ) : (
        <div className={styles['list']}>
          {charges.map((charge) => (
            <ChargeCard key={charge.id} charge={charge} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * /rentals/:id/charges - a narrow, single-purpose page (same principle as
 * RentalContractsPage/RentalTermsPage, explicitly not a general rental
 * detail view) for reading a rental relationship's charges and their
 * payment-derived status, and generating RENT charges
 * (generate_rent_charges). No manual charge creation, no edit/delete/void,
 * no payment reporting/allocation UI - see this feature's own scope notes.
 */
export default function RentalChargesPage() {
  const { t } = useTranslation('rentals')
  const { id } = useParams<{ id: string }>()
  const currentAdministration = useActiveAdministration()

  if (!id) {
    return (
      <div className={styles['page']}>
        <Alert tone="danger">{t('termsForm.errors.missingRelationship')}</Alert>
      </div>
    )
  }

  if (currentAdministration.status === 'loading') {
    return (
      <div className={styles['page']} data-testid="rental-charges-loading">
        <Skeleton height={32} width={240} />
        <Skeleton height={120} radius="lg" />
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
        <Alert tone="danger">{t('noAdministration.title')}</Alert>
      </div>
    )
  }

  if (currentAdministration.status === 'selection-required') {
    return (
      <div className={styles['page']}>
        <AdministrationPicker options={currentAdministration.options} onSelect={currentAdministration.select} />
      </div>
    )
  }

  return <RentalChargesView administrationId={currentAdministration.administration.id} relationshipId={id} />
}
