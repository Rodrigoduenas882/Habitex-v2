import type { ReactNode } from 'react'
import { useTranslation, type UseTranslationResponse } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useActiveAdministration } from '@/features/administration/application/useActiveAdministration'
import { useManagementGate } from '@/features/administration/application/useManagementGate'
import { AdministrationPicker } from '@/features/administration/presentation/AdministrationPicker'
// Cross-feature import, explicitly authorized for this remediation (Codex
// NO-GO on PR #31, P1): reads payments.json's own existing copy
// (empty/error/status) and `usePayments` - read-only, never a mutation,
// same reuse principle already established the other way around
// (RentalPaymentsPage already imports useCharges). See this file's own
// FinancialOverview-area doc comment below for the full reasoning.
import { usePayments } from '@/features/payments/application/usePayments'
import type { Payment, PaymentStatus } from '@/features/payments/domain/payment.types'
import { useRentals } from '@/features/rentals/application/useRentals'
import { RentalContextHeader } from '@/features/rentals/presentation/RentalContextHeader'
import { cx } from '@/shared/lib/cx'
import { Alert } from '@/shared/ui/Alert'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { AlertTriangleIcon, CheckIcon, WalletIcon } from '@/shared/ui/icons'
import { IconBadge, type IconBadgeTone } from '@/shared/ui/IconBadge'
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

/** Same semantic tones RentalPaymentsPage's own STATUS_TONE uses for
 * `Payment.status` - duplicated locally (not imported) because it's a tiny
 * lookup table, same convention as every other per-file STATUS_TONE in this
 * codebase (RentalListCard, RentalContractsPage, this file's own charge
 * STATUS_TONE above). */
const PAYMENT_STATUS_TONE: Record<PaymentStatus, BadgeTone> = {
  REPORTED: 'neutral',
  CONFIRMED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
}

interface ChargeCardProps {
  charge: Charge
}

/** One read-only charge row: an IconBadge identity header (icon + charge
 * type/description + status Badge, same visual family as RentalListCard's
 * own header, docs/DESIGN.md §16.2) followed by period (when present), due
 * date, amount/paid/balance (all `.tabular-nums` per DESIGN.md §4). No
 * edit/delete/void action anywhere - charges are strictly read-only in this
 * increment (see this feature's own scope notes). */
function ChargeCard({ charge }: ChargeCardProps) {
  const { t } = useTranslation('charges')

  return (
    <Card className={styles['chargeCard']}>
      <div className={styles['chargeHeader']}>
        <IconBadge icon={<WalletIcon size={18} />} tone="neutral" size={36} radius="md" />
        <div className={styles['identity']}>
          <p className={styles['title']}>{t(`type.${charge.chargeType}`)}</p>
          <p className="text-body-sm text-muted">{charge.description}</p>
        </div>
        <Badge tone={STATUS_TONE[charge.financialStatus]}>{t(`financialStatus.${charge.financialStatus}`)}</Badge>
      </div>
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

/**
 * Desktop (>=1024px) "filas compactas" presentation of the same charges
 * (Codex NO-GO on PR #31, P1 - Figma 372:3) - a real `<table>` with
 * accessible column headers, same exact dual-render technique already
 * established by PropertiesPage (docs/DESIGN.md §15.1/§15.3): both this
 * table and `ChargeCard`'s compact-card list below always render in the
 * DOM, and CSS alone (`.tableWrap`/`.compactList`, see this file's own
 * module.css) decides which one is visible at a given width, reusing the
 * existing 1024px breakpoint - no new one introduced, no JS media-query
 * branching. `display:none` removes the hidden one from the accessibility
 * tree too, so nothing doubles up for assistive tech. Same data, same
 * fields, same STATUS_TONE as ChargeCard - purely a denser layout for wide
 * viewports, never a second source of truth.
 */
function ChargesTable({ charges }: { charges: Charge[] }) {
  const { t } = useTranslation('charges')

  return (
    <div className={styles['tableWrap']} role="region" aria-label={t('title')} tabIndex={0} data-testid="charges-table">
      <table className={styles['table']}>
        <caption className="sr-only">{t('title')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('table.type')}</th>
            <th scope="col">{t('table.description')}</th>
            <th scope="col">{t('table.dueDate')}</th>
            <th scope="col">{t('table.amount')}</th>
            <th scope="col">{t('table.paidAmount')}</th>
            <th scope="col">{t('table.balance')}</th>
            <th scope="col">{t('table.status')}</th>
          </tr>
        </thead>
        <tbody>
          {charges.map((charge) => (
            <tr key={charge.id}>
              <td>{t(`type.${charge.chargeType}`)}</td>
              <td>{charge.description}</td>
              <td>{formatDate(charge.dueDate)}</td>
              <td className="tabular-nums">{formatAmount(charge.amount)}</td>
              <td className="tabular-nums">{formatAmount(charge.paidAmount)}</td>
              <td className="tabular-nums">{formatAmount(charge.balance)}</td>
              <td>
                <Badge tone={STATUS_TONE[charge.financialStatus]}>
                  {t(`financialStatus.${charge.financialStatus}`)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

interface FinancialSummaryTileProps {
  icon: ReactNode
  tone: IconBadgeTone
  label: string
  value: string
  to?: string
}

/**
 * One scalar of the "resumen financiero" (Codex NO-GO on PR #31, P1 -
 * Figma 372:3/372:330 - "monto/saldo prioritarios"). Deliberately NOT
 * `KpiCard` (`features/dashboard/presentation/KpiCard.tsx`): that
 * component's own CSS module sets `--dashboard-glass-surface` +
 * `backdrop-filter`, and docs/DESIGN.md §14 reserves that glass treatment
 * **exclusively** for the Dashboard's 4 KPI cards and the user-menu
 * trigger ("las tablas conservan fondos sólidos") - reusing it verbatim
 * here would import that exception into a page §14 never named. This is a
 * plain `Card` (solid `--color-surface`, same as every other surface on
 * this page) + `IconBadge` + a `text-h3 tabular-nums` value, no glass, no
 * new primitive. `to` mirrors KpiCard's own DS-004 pattern (an honest,
 * real navigation destination for this one metric) - used only for the
 * balance tile, linking to `/rentals/:id/payments` (contextual navigation
 * to payment detail, explicitly requested by the remediation instead of
 * duplicating any payment action here).
 */
function FinancialSummaryTile({ icon, tone, label, value, to }: FinancialSummaryTileProps) {
  const content = (
    <Card className={styles['summaryTile']} interactive={Boolean(to)}>
      <IconBadge icon={icon} tone={tone} size={32} radius="md" />
      <div className={styles['summaryTileBody']}>
        <p className="text-caption text-muted">{label}</p>
        <p className={cx('text-h3', 'tabular-nums')}>{value}</p>
      </div>
    </Card>
  )

  if (to) {
    return (
      <Link to={to} className={styles['summaryTileLink']}>
        {content}
      </Link>
    )
  }

  return content
}

/**
 * The "monto/saldo prioritarios" summary row (Figma 372:3/372:330). All 3
 * values are plain sums over the already-fetched `charges` (never a second
 * read): `charge.amount`/`charge.paidAmount`/`charge.balance` are each
 * already server-derived from `public.charge_balances`
 * (`paid_amount`/`balance` only ever reflect CONFIRMED, allocated payments
 * - see `docs/agentic/PROGRESS.md` INC-012/014) - summing them client-side
 * never recomputes or guesses at a financial rule the backend already
 * owns. Deliberately does NOT sum `Payment.amount` for anything shown
 * here - a REPORTED/REJECTED payment's amount is not the same fact as an
 * allocated/confirmed one, and conflating them was exactly the semantic
 * risk this remediation called out. Only rendered when there is at least
 * one charge - an empty administration showing "$0" everywhere would look
 * like a real (if boring) balance rather than "nothing to summarize yet",
 * so this intentionally stays absent instead, same principle as
 * RentalListCard's own rentAmountUnknown fallback (never fabricate a 0).
 */
function FinancialSummary({ charges, relationshipId }: { charges: Charge[]; relationshipId: string }) {
  const { t } = useTranslation('charges')

  const totalAmount = charges.reduce((sum, charge) => sum + charge.amount, 0)
  const totalPaid = charges.reduce((sum, charge) => sum + charge.paidAmount, 0)
  const totalBalance = charges.reduce((sum, charge) => sum + charge.balance, 0)

  return (
    <section className={styles['section']}>
      <h2 className="text-h3">{t('overview.title')}</h2>
      <div className={styles['summaryRow']}>
        <FinancialSummaryTile
          icon={<WalletIcon size={16} />}
          tone="info"
          label={t('overview.totalAmount')}
          value={formatAmount(totalAmount)}
        />
        <FinancialSummaryTile
          icon={<CheckIcon size={16} />}
          tone="success"
          label={t('overview.totalPaid')}
          value={formatAmount(totalPaid)}
        />
        <FinancialSummaryTile
          icon={<AlertTriangleIcon size={16} />}
          tone={totalBalance > 0 ? 'warning' : 'success'}
          label={t('overview.totalBalance')}
          value={formatAmount(totalBalance)}
          to={`/rentals/${relationshipId}/payments`}
        />
      </div>
    </section>
  )
}

interface PaymentHistoryRowProps {
  payment: Payment
}

/**
 * One read-only row of the "historial de pagos" (Figma 372:3/372:330) -
 * identity only (IconBadge + amount/date + status Badge, same header
 * pattern as `PaymentCard`'s own header in RentalPaymentsPage.tsx), never
 * any of PaymentCard's Details/Application/Receipt/Actions zones. No
 * confirm/reject/allocate/issue-receipt action lives here - those stay
 * exclusively on `/rentals/:id/payments` (Codex NO-GO on PR #31: "no
 * duplicar lógica financiera"). This is a preview, not a replacement.
 */
function PaymentHistoryRow({ payment }: PaymentHistoryRowProps) {
  const { t } = useTranslation('payments')

  return (
    <Card className={styles['paymentHistoryRow']}>
      <IconBadge icon={<WalletIcon size={16} />} tone="neutral" size={32} radius="md" />
      <div className={styles['identity']}>
        <p className={cx('text-body-sm', 'tabular-nums', styles['title'])}>
          {t('card.amount', { amount: formatAmount(payment.amount) })}
        </p>
        <p className="text-caption text-muted">{formatDate(payment.paymentDate)}</p>
      </div>
      <Badge tone={PAYMENT_STATUS_TONE[payment.status]}>{t(`status.${payment.status}`)}</Badge>
    </Card>
  )
}

/**
 * The "historial de pagos dentro de una experiencia del arriendo" section
 * (Figma 372:3/372:330, Codex NO-GO on PR #31, P1). Reads the SAME
 * `usePayments` query `/rentals/:id/payments` itself uses (shared
 * TanStack Query cache by query key - visiting this page first, then
 * Payments, is never a second network request in practice, same reasoning
 * already established for `useRentalIdentities`/`RentalContextHeader`).
 * Owns its own loading/error/empty handling, independent of the charges
 * list above - a relationship can have payments reported with zero
 * charges generated yet (report_payment never requires a charge_id, see
 * `docs/agentic/PROGRESS.md` INC-013), so gating this on `charges.length`
 * would hide real data. "Ver todos los pagos" is the only entry point to
 * any payment action - this section itself never renders one.
 */
function PaymentsHistorySection({ administrationId, relationshipId }: { administrationId: string; relationshipId: string }) {
  const { t } = useTranslation(['charges', 'payments'])
  const navigate = useNavigate()
  const paymentsQuery = usePayments(administrationId, relationshipId)

  return (
    <section className={styles['section']}>
      <div className={styles['sectionHeader']}>
        <h2 className="text-h3">{t('paymentsHistory.title')}</h2>
        {/* Plain-navigation ghost Button, same pattern as RentalListCard's
            own "Completar términos"/"Contratos"/"Cargos"/"Pagos" actions -
            never a styled text link (DESIGN.md §2's --color-link pair is
            documented as exclusive to the public auth screens). */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            void navigate(`/rentals/${relationshipId}/payments`)
          }}
        >
          {t('paymentsHistory.viewAll')}
        </Button>
      </div>

      {paymentsQuery.isLoading ? (
        <Skeleton height={64} radius="lg" />
      ) : paymentsQuery.isError ? (
        <Alert tone="danger">{t('payments:errors.paymentsDescription')}</Alert>
      ) : (paymentsQuery.data ?? []).length === 0 ? (
        <p className="text-body-sm text-muted">{t('payments:empty.title')}</p>
      ) : (
        <div className={styles['paymentHistoryList']}>
          {(paymentsQuery.data ?? []).map((payment) => (
            <PaymentHistoryRow key={payment.id} payment={payment} />
          ))}
        </div>
      )}
    </section>
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
      <RentalContextHeader administrationId={administrationId} relationshipId={relationshipId} activeSection="charges" />
      <p className="text-body-sm text-muted">{t('description')}</p>

      {charges.length > 0 ? <FinancialSummary charges={charges} relationshipId={relationshipId} /> : null}

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
        <>
          <ChargesTable charges={charges} />
          <div className={styles['compactList']} data-testid="charges-compact-list">
            {charges.map((charge) => (
              <ChargeCard key={charge.id} charge={charge} />
            ))}
          </div>
        </>
      )}

      <PaymentsHistorySection administrationId={administrationId} relationshipId={relationshipId} />
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
