import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation, type UseTranslationResponse } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useActiveAdministration } from '@/features/administration/application/useActiveAdministration'
import { useManagementGate, type ManagementGateResult } from '@/features/administration/application/useManagementGate'
import { AdministrationPicker } from '@/features/administration/presentation/AdministrationPicker'
// Cross-feature import, explicitly human-authorized for this increment (see
// this file's own module doc comment on the allocation section below) -
// reused exactly as exported, never modified.
import { useCharges } from '@/features/charges/application/useCharges'
import { fileRepository } from '@/features/documents/composition'
import type { FileMetadata } from '@/features/documents/domain/file.types'
import { useRentals } from '@/features/rentals/application/useRentals'
import { cx } from '@/shared/lib/cx'
import { Alert } from '@/shared/ui/Alert'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { WalletIcon } from '@/shared/ui/icons'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Textarea } from '@/shared/ui/Textarea'
import styles from './RentalPaymentsPage.module.css'
import {
  PAYMENT_ALLOCATION_FORM_DEFAULTS,
  paymentAllocationFormSchema,
  type PaymentAllocationFormValues,
} from './payment-allocation-form'
import {
  PAYMENT_REPORT_FORM_DEFAULTS,
  paymentReportFormSchema,
  toReportPaymentInput,
  type PaymentReportFormValues,
} from './payment-report-form'
import { summarizePaymentAllocations } from '../application/payment-allocation-summary'
import { paymentQueryKeys } from '../application/payment-query-keys'
import { useAllocatePayment } from '../application/useAllocatePayment'
import { useConfirmPayment } from '../application/useConfirmPayment'
import { usePaymentAllocations } from '../application/usePaymentAllocations'
import { usePaymentProofUpload } from '../application/usePaymentProofUpload'
import { usePayments } from '../application/usePayments'
import { useRejectPayment } from '../application/useRejectPayment'
import { useReportPayment } from '../application/useReportPayment'
import { PaymentRepositoryError, type Payment, type PaymentMethod, type PaymentStatus } from '../domain/payment.types'

type PaymentsT = UseTranslationResponse<['payments', 'administration'], undefined>['t']

const PAYMENT_METHOD_OPTIONS: readonly PaymentMethod[] = ['BANK_TRANSFER', 'CASH', 'DIGITAL_WALLET', 'OTHER']

/**
 * Existing semantic tones only (see DESIGN.md), same principle as
 * RentalChargesPage's/RentalContractsPage's own STATUS_TONE. CONFIRMED is
 * the one unambiguously positive state; REJECTED is the one closest to a
 * problem; REPORTED is a plain, needs-action state; CANCELLED is a plain
 * neutral state (unreachable in practice - see PaymentStatus's own doc
 * comment, rendered defensively for enum exhaustiveness only).
 */
const STATUS_TONE: Record<PaymentStatus, BadgeTone> = {
  REPORTED: 'neutral',
  CONFIRMED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
}

function formatDate(value: string): string {
  // Stored as a plain date (no time/zone) - parsed at local midnight so it
  // never shifts a day depending on the viewer's timezone (same pattern as
  // RentalChargesPage's/RentalListCard's own formatDate).
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`),
  )
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

/** Plain Intl.NumberFormat('es-CO'), no currency selector or decimals - COP
 * is the only currency this frontend ever displays, same pattern as
 * RentalChargesPage's own formatAmount. */
function formatAmount(value: number): string {
  return `$${new Intl.NumberFormat('es-CO').format(value)}`
}

/** Maps a caught report_payment error to its specific reportForm copy, or
 * the generic 'unknown' fallback for anything else (including plain upload
 * failures, which never carry a PaymentErrorCode). Only the codes
 * report_payment can actually raise get their own key - 'payment_not_reported'
 * is confirm_payment/reject_payment-only and never reachable here. */
function reportPaymentErrorMessage(t: PaymentsT, error: unknown): string {
  if (error instanceof PaymentRepositoryError) {
    switch (error.code) {
      case 'forbidden':
        return t('reportForm.errors.forbidden')
      case 'invalid_amount':
        return t('reportForm.errors.invalid_amount')
      case 'invalid_proof_file':
        return t('reportForm.errors.invalid_proof_file')
      default:
        return t('reportForm.errors.unknown')
    }
  }
  return t('reportForm.errors.unknown')
}

/** Maps a caught confirm_payment error to its specific copy - only the codes
 * confirm_payment can actually raise ('forbidden'/'payment_not_reported')
 * get their own key. */
function confirmActionErrorMessage(t: PaymentsT, error: unknown): string {
  if (error instanceof PaymentRepositoryError) {
    switch (error.code) {
      case 'payment_not_reported':
        return t('card.actions.confirm.errors.payment_not_reported')
      case 'forbidden':
        return t('card.actions.confirm.errors.forbidden')
      default:
        return t('card.actions.confirm.errors.unknown')
    }
  }
  return t('card.actions.confirm.errors.unknown')
}

/** Same principle as confirmActionErrorMessage, for reject_payment. */
function rejectActionErrorMessage(t: PaymentsT, error: unknown): string {
  if (error instanceof PaymentRepositoryError) {
    switch (error.code) {
      case 'payment_not_reported':
        return t('card.actions.reject.errors.payment_not_reported')
      case 'forbidden':
        return t('card.actions.reject.errors.forbidden')
      default:
        return t('card.actions.reject.errors.unknown')
    }
  }
  return t('card.actions.reject.errors.unknown')
}

/**
 * Maps a caught allocate_payment error to its specific copy - every
 * PaymentErrorCode allocate_payment can actually raise gets its own key
 * (see PaymentErrorCode's own doc comment for the exact mapping), including
 * 'allocation_exceeds_payment'/'allocation_exceeds_charge', whose copy is
 * deliberately framed as a stale/concurrent-state message ("ese valor ya no
 * está disponible... actualizando") rather than a plain failure - see this
 * file's own handleAllocationStaleState for the accompanying refetch.
 * 'invalid_amount' never has its own key here - the client-side form guard
 * already prevents a non-positive amount from ever reaching the RPC, so a
 * raw 23514 check_violation falls into the 'unknown' fallback like any other
 * unreachable-in-practice code.
 */
function allocatePaymentErrorMessage(t: PaymentsT, error: unknown): string {
  if (error instanceof PaymentRepositoryError) {
    switch (error.code) {
      case 'payment_not_confirmed':
        return t('card.allocations.errors.payment_not_confirmed')
      case 'allocation_scope_mismatch':
        return t('card.allocations.errors.allocation_scope_mismatch')
      case 'allocation_exceeds_payment':
        return t('card.allocations.errors.allocation_exceeds_payment')
      case 'allocation_exceeds_charge':
        return t('card.allocations.errors.allocation_exceeds_charge')
      case 'duplicate_allocation':
        return t('card.allocations.errors.duplicate_allocation')
      case 'forbidden':
        return t('card.allocations.errors.forbidden')
      default:
        return t('card.allocations.errors.unknown')
    }
  }
  return t('card.allocations.errors.unknown')
}

/**
 * Downloads proofFileId's bytes via fileRepository.getById + .download(),
 * mirroring RentalContractsPage's ContractFileDownloadButton exactly (object
 * URL + a temporary <a download> click, never createSignedUrl/a public URL).
 * Deliberately calls fileRepository directly rather than through a query
 * hook - a single on-demand lookup right before downloading, not something
 * this page needs to keep fresh/cached.
 */
function PaymentProofDownloadButton({ proofFileId }: { proofFileId: string }) {
  const { t } = useTranslation('payments')
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadFailed, setDownloadFailed] = useState(false)

  const handleClick = () => {
    setDownloadFailed(false)
    setIsDownloading(true)
    void (async () => {
      try {
        const metadata = await fileRepository.getById(proofFileId)
        if (!metadata) {
          setDownloadFailed(true)
          return
        }
        const blob = await fileRepository.download(metadata)
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = metadata.originalName ?? metadata.id
        link.click()
        URL.revokeObjectURL(url)
      } catch {
        setDownloadFailed(true)
      } finally {
        setIsDownloading(false)
      }
    })()
  }

  return (
    <div className={styles['downloadAction']}>
      <Button type="button" variant="ghost" size="sm" loading={isDownloading} disabled={isDownloading} onClick={handleClick}>
        {t('card.proofDownload')}
      </Button>
      {downloadFailed ? <p className="text-caption text-muted">{t('card.downloadError')}</p> : null}
    </div>
  )
}

interface RejectPaymentActionProps {
  disabled: boolean
  blockReasonText: string | null
  isPending: boolean
  errorMessage: string | null
  onConfirm: () => void
}

/**
 * Two-step inline confirmation for reject_payment (REPORTED -> REJECTED) -
 * the one irreversible-negative payment action, mirroring
 * TerminateContractAction/LifecycleConfirmAction byte-for-byte in structure.
 * Not exported/shared across features - same reasoning as
 * TerminateContractAction's own doc comment (no cross-feature refactor for
 * this scope).
 *
 * The first click only flips local `confirming` state - it never calls
 * onConfirm. Once confirming, the single trigger button is replaced by two
 * distinct elements (destructive "Confirmar rechazo" + secondary "Volver"),
 * and focus moves to the confirm button on that transition. `disabled` also
 * accounts for the sibling Confirm action's own pending state (the
 * competing-transition guard), disabling both "Confirmar rechazo" and
 * "Volver" whenever either mutation for this card is in flight.
 */
function RejectPaymentAction({ disabled, blockReasonText, isPending, errorMessage, onConfirm }: RejectPaymentActionProps) {
  const { t } = useTranslation('payments')
  const [confirming, setConfirming] = useState(false)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirming) {
      confirmButtonRef.current?.focus()
    }
  }, [confirming])

  if (!confirming) {
    return (
      <>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={disabled}
          aria-disabled={disabled ? 'true' : undefined}
          onClick={() => {
            setConfirming(true)
          }}
        >
          {t('card.actions.reject.cta')}
        </Button>
        {disabled && blockReasonText ? <p className="text-caption text-muted">{blockReasonText}</p> : null}
      </>
    )
  }

  const busy = isPending || disabled

  return (
    <>
      <div className={styles['confirmActions']}>
        <Button
          ref={confirmButtonRef}
          type="button"
          variant="destructive"
          size="sm"
          loading={isPending}
          disabled={busy}
          onClick={onConfirm}
        >
          {t('card.actions.reject.confirmCta')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => {
            setConfirming(false)
          }}
        >
          {t('card.actions.reject.back')}
        </Button>
      </div>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
    </>
  )
}

interface PaymentAllocationAmountFormProps {
  administrationId: string
  relationshipId: string
  paymentId: string
  chargeId: string
  paymentRemainingAmount: number
  chargeBalance: number
  managementGate: ManagementGateResult
  onAllocated: () => void
  /**
   * Carries the mapped error message of a stale/concurrent
   * ALLOCATION_EXCEEDS_PAYMENT/ALLOCATION_EXCEEDS_CHARGE failure, rather than
   * firing with no argument - the parent chain (PaymentAllocationSection ->
   * PaymentAllocationSummary) keeps this message visible even after the
   * refetch it triggers causes this form's own subtree to unmount (e.g. once
   * remainingAmount reaches 0 and PaymentAllocationSection is replaced by the
   * "fully applied" success state), so the user who just had their own
   * submission rejected still sees why, instead of only a plain success
   * message.
   */
  onStaleAllocationState: (message: string) => void
  /**
   * Fired as the very first thing on every submit (see this form's own
   * onSubmit below), before allocatePayment.mutate - clears
   * PaymentAllocationSummary's lifted staleAllocationError so a message from
   * a previous, already-resolved attempt never survives into a new one. This
   * covers the gap left by clearing only on reopen (see
   * PaymentAllocationSummary's own staleAllocationError doc comment): a
   * second attempt submitted without closing the section - whether it
   * succeeds or fails with an unrelated code - must not keep rendering a
   * stale message from a prior, distinct attempt.
   */
  onNewAttempt: () => void
}

/**
 * The amount-entry step of "Aplicar a cargos", mounted by its parent
 * (PaymentAllocationSection) with `key={chargeId}` - a fresh useForm/schema
 * instance per selected charge, since `maximum` (this form's own dynamic
 * validation bound, min(paymentRemainingAmount, chargeBalance)) changes
 * whenever the selected charge changes, unlike every other schema-factory
 * parameter in this codebase (e.g. rentalTermsFormSchema(t) - t never
 * changes during a form's lifetime). Remounting on selection change is the
 * simplest correct way to guarantee validation always uses the right bound,
 * and it also naturally clears the amount field for a newly-selected charge.
 *
 * `managementGate` is threaded down as a live prop (not just relied upon via
 * the trigger button one level up in PaymentAllocationSummary, which is only
 * checked once when the section is first opened) so a mid-session change -
 * e.g. the subscription expiring while this form is already open - disables
 * the amount input and submit button on the very next render. React
 * re-renders this whole tree whenever the underlying useSubscription query
 * (which useManagementGate wraps) updates, so this stays live for free.
 */
function PaymentAllocationAmountForm({
  administrationId,
  relationshipId,
  paymentId,
  chargeId,
  paymentRemainingAmount,
  chargeBalance,
  managementGate,
  onAllocated,
  onStaleAllocationState,
  onNewAttempt,
}: PaymentAllocationAmountFormProps) {
  const { t } = useTranslation(['payments', 'administration'])
  const allocatePayment = useAllocatePayment()
  const maximum = Math.min(paymentRemainingAmount, chargeBalance)

  const schema = paymentAllocationFormSchema(t, maximum)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PaymentAllocationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: PAYMENT_ALLOCATION_FORM_DEFAULTS,
  })

  const onSubmit = handleSubmit((values) => {
    onNewAttempt()
    allocatePayment.mutate(
      {
        administrationId,
        rentalRelationshipId: relationshipId,
        paymentId,
        chargeId,
        amount: Number(values.amount),
      },
      {
        onSuccess: onAllocated,
        // On a stale/concurrent ALLOCATION_EXCEEDS_PAYMENT/
        // ALLOCATION_EXCEEDS_CHARGE (another allocation won a race since
        // `maximum` was computed), useAllocatePayment's own onSuccess
        // invalidation never runs - this refetches both queries directly so
        // the UI's numbers catch up, same handleStaleState principle as
        // PaymentCard's own confirm/reject actions above.
        onError: (error) => {
          if (
            error instanceof PaymentRepositoryError &&
            (error.code === 'allocation_exceeds_payment' || error.code === 'allocation_exceeds_charge')
          ) {
            onStaleAllocationState(allocatePaymentErrorMessage(t, error))
          }
        },
      },
    )
  })

  // A stale/concurrent ALLOCATION_EXCEEDS_PAYMENT/ALLOCATION_EXCEEDS_CHARGE
  // is already surfaced by the parent chain via onStaleAllocationState (see
  // this form's own onError above and PaymentAllocationSummary's
  // staleAllocationError) - excluded here so it never renders twice while
  // this form stays mounted alongside that lifted message. Every other
  // allocate_payment error is local-only and still rendered right here.
  const isLiftedStaleError =
    allocatePayment.isError &&
    allocatePayment.error instanceof PaymentRepositoryError &&
    (allocatePayment.error.code === 'allocation_exceeds_payment' || allocatePayment.error.code === 'allocation_exceeds_charge')
  const errorMessage =
    allocatePayment.isError && !isLiftedStaleError ? allocatePaymentErrorMessage(t, allocatePayment.error) : null

  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event)
      }}
      noValidate
      className={styles['form']}
    >
      <p className="text-caption text-muted">
        {t('card.allocations.form.availableFromPayment', { amount: formatAmount(paymentRemainingAmount) })}
      </p>
      <p className="text-caption text-muted">
        {t('card.allocations.form.pendingFromCharge', { amount: formatAmount(chargeBalance) })}
      </p>
      <p className="text-caption text-muted">
        {t('card.allocations.form.maximumApplicable', { amount: formatAmount(maximum) })}
      </p>
      <Input
        type="number"
        min={0}
        max={maximum}
        step="any"
        label={t('card.allocations.form.amount.label')}
        error={errors.amount?.message}
        disabled={allocatePayment.isPending || managementGate.blocked}
        {...register('amount')}
      />
      <Button
        type="submit"
        size="sm"
        loading={allocatePayment.isPending}
        disabled={allocatePayment.isPending || managementGate.blocked}
        className={styles['submit']}
      >
        {allocatePayment.isPending ? t('card.allocations.form.submitting') : t('card.allocations.form.submit')}
      </Button>
      {managementGate.blocked ? (
        <p className="text-caption text-muted">{t('administration:managementAccessGate.blocked')}</p>
      ) : null}
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
    </form>
  )
}

interface PaymentAllocationSectionProps {
  administrationId: string
  relationshipId: string
  payment: Payment
  remainingAmount: number
  allocatedChargeIds: Set<string>
  managementGate: ManagementGateResult
  onClose: () => void
  /**
   * Bubbles the mapped stale-allocation-error message up to
   * PaymentAllocationSummary - see PaymentAllocationAmountFormProps's own doc
   * comment for why this carries the message instead of firing bare.
   */
  onStaleAllocationState: (message: string) => void
  /**
   * Straight pass-through down to PaymentAllocationAmountForm - see that
   * component's own onNewAttempt doc comment.
   */
  onNewAttempt: () => void
}

/**
 * The inline "Aplicar a cargos" workflow, only mounted while its parent
 * (PaymentAllocationSummary) has it open - useCharges only fires once this
 * section actually renders, never eagerly for every CONFIRMED payment on the
 * page. Eligible charges are this relationship's own charges (useCharges is
 * already scoped by relationshipId, but filtered explicitly here too so a
 * scope mismatch would break loud instead of silently) with balance > 0,
 * excluding any charge this payment has already allocated to - there is no
 * "increase an existing allocation" RPC path (see AllocatePaymentInput's own
 * doc comment), so a partially-or-fully-allocated-by-this-payment charge is
 * hidden entirely rather than shown disabled.
 */
function PaymentAllocationSection({
  administrationId,
  relationshipId,
  payment,
  remainingAmount,
  allocatedChargeIds,
  managementGate,
  onClose,
  onStaleAllocationState,
  onNewAttempt,
}: PaymentAllocationSectionProps) {
  const { t } = useTranslation('payments')
  const chargesQuery = useCharges(administrationId, relationshipId)
  const [selectedChargeId, setSelectedChargeId] = useState('')

  const eligibleCharges = (chargesQuery.data ?? []).filter(
    (charge) => charge.rentalRelationshipId === relationshipId && charge.balance > 0 && !allocatedChargeIds.has(charge.id),
  )
  const selectedCharge = eligibleCharges.find((charge) => charge.id === selectedChargeId) ?? null

  return (
    <div className={styles['allocationSection']}>
      {chargesQuery.isLoading ? (
        <Skeleton height={80} radius="md" />
      ) : chargesQuery.isError ? (
        <p className="text-caption text-muted">{t('card.allocations.chargesLoadError')}</p>
      ) : eligibleCharges.length === 0 ? (
        <p className="text-caption text-muted">{t('card.allocations.noEligibleCharges')}</p>
      ) : (
        <>
          <Select
            label={t('card.allocations.chargeSelect.label')}
            value={selectedChargeId}
            onChange={(event) => {
              setSelectedChargeId(event.target.value)
            }}
          >
            <option value="">{t('card.allocations.chargeSelect.placeholder')}</option>
            {eligibleCharges.map((charge) => (
              <option key={charge.id} value={charge.id}>
                {t('card.allocations.chargeSelect.option', {
                  description: charge.description,
                  dueDate: formatDate(charge.dueDate),
                  balance: formatAmount(charge.balance),
                })}
              </option>
            ))}
          </Select>
          {selectedCharge ? (
            <PaymentAllocationAmountForm
              key={selectedCharge.id}
              administrationId={administrationId}
              relationshipId={relationshipId}
              paymentId={payment.id}
              chargeId={selectedCharge.id}
              paymentRemainingAmount={remainingAmount}
              chargeBalance={selectedCharge.balance}
              managementGate={managementGate}
              onAllocated={() => {
                setSelectedChargeId('')
              }}
              onNewAttempt={onNewAttempt}
              onStaleAllocationState={(message) => {
                // This section owns the charges query - refetch it directly
                // here, and bubble up to the parent (PaymentAllocationSummary)
                // for its own usePaymentAllocations refetch, so a stale
                // ALLOCATION_EXCEEDS_PAYMENT/ALLOCATION_EXCEEDS_CHARGE
                // refreshes both halves of this feature's stale-state data.
                // The message itself is only bubbled up, not shown here -
                // PaymentAllocationSummary is the layer that survives this
                // section unmounting (e.g. once remainingAmount reaches 0),
                // so it's the one that keeps it visible.
                void chargesQuery.refetch()
                onStaleAllocationState(message)
              }}
            />
          ) : null}
        </>
      )}
      <Button type="button" variant="secondary" size="sm" className={styles['cancelAction']} onClick={onClose}>
        {t('card.allocations.cancel')}
      </Button>
    </div>
  )
}

interface PaymentAllocationSummaryProps {
  payment: Payment
  administrationId: string
  relationshipId: string
  managementGate: ManagementGateResult
}

/**
 * Only rendered for status === 'CONFIRMED' (see PaymentCard below). Owns its
 * own usePaymentAllocations instance - same per-row-independent-hook-
 * instance pattern as useConfirmPayment/useRejectPayment in PaymentCard -
 * and computes allocatedAmount/remainingAmount via
 * summarizePaymentAllocations. Reading this summary (the allocated/
 * remaining amounts, and the "fully applied" message) never depends on
 * useManagementGate - only opening/submitting the inline "Aplicar a cargos"
 * section does, the same read/write authorization asymmetry as report/
 * confirm/reject elsewhere in this file (payment_allocations_select only
 * requires can_view_relationship(), while allocate_payment requires
 * can_manage_administration()).
 */
function PaymentAllocationSummary({ payment, administrationId, relationshipId, managementGate }: PaymentAllocationSummaryProps) {
  const { t } = useTranslation(['payments', 'administration'])
  const allocationsQuery = usePaymentAllocations(administrationId, payment.id)
  const [isOpen, setIsOpen] = useState(false)
  // Set by PaymentAllocationSection's onStaleAllocationState on a stale
  // ALLOCATION_EXCEEDS_PAYMENT/ALLOCATION_EXCEEDS_CHARGE failure - kept here
  // (rather than only in the amount form's own local state) so the message
  // survives PaymentAllocationSection unmounting, e.g. when the refetch it
  // triggers resolves with remainingAmount === 0 and this component swaps to
  // the "fully applied" success state. Cleared in two places: when the user
  // closes "Aplicar a cargos" and opens it again for a fresh attempt, and -
  // so it never survives a second, distinct attempt submitted without
  // closing the section first (different charge, or a smaller amount for the
  // same charge) - at the start of every new submission via onNewAttempt,
  // threaded down to PaymentAllocationAmountForm's own onSubmit (see that
  // component's onNewAttempt doc comment).
  const [staleAllocationError, setStaleAllocationError] = useState<string | null>(null)

  if (allocationsQuery.isLoading) {
    return (
      <div className={styles['allocationSummary']}>
        <Skeleton height={16} width={200} />
      </div>
    )
  }

  if (allocationsQuery.isError) {
    return (
      <div className={styles['allocationSummary']}>
        <p className="text-caption text-muted">{t('card.allocations.loadError')}</p>
      </div>
    )
  }

  const allocations = allocationsQuery.data ?? []
  const { allocatedAmount, remainingAmount } = summarizePaymentAllocations(payment, allocations)

  return (
    <div className={styles['allocationSummary']}>
      <p className={cx('text-body-sm', 'tabular-nums')}>
        {t('card.allocations.allocatedAmount', { amount: formatAmount(allocatedAmount) })}
      </p>
      <p className={cx('text-body-sm', 'tabular-nums')}>
        {t('card.allocations.remainingAmount', { amount: formatAmount(remainingAmount) })}
      </p>
      {staleAllocationError ? <Alert tone="danger">{staleAllocationError}</Alert> : null}
      {remainingAmount === 0 ? (
        <Alert tone="success">{t('card.allocations.fullyApplied')}</Alert>
      ) : isOpen ? (
        <PaymentAllocationSection
          administrationId={administrationId}
          relationshipId={relationshipId}
          payment={payment}
          remainingAmount={remainingAmount}
          allocatedChargeIds={new Set(allocations.map((allocation) => allocation.chargeId))}
          managementGate={managementGate}
          onClose={() => {
            setIsOpen(false)
          }}
          onStaleAllocationState={(message) => {
            setStaleAllocationError(message)
            void allocationsQuery.refetch()
          }}
          onNewAttempt={() => {
            setStaleAllocationError(null)
          }}
        />
      ) : (
        <div className={styles['actionsRow']}>
          <Button
            type="button"
            size="sm"
            disabled={managementGate.blocked}
            aria-disabled={managementGate.blocked ? 'true' : undefined}
            onClick={() => {
              setStaleAllocationError(null)
              setIsOpen(true)
            }}
          >
            {t('card.allocations.trigger')}
          </Button>
          {managementGate.blocked ? (
            <p className="text-caption text-muted">{t('administration:managementAccessGate.blocked')}</p>
          ) : null}
        </div>
      )}
    </div>
  )
}

interface PaymentCardProps {
  payment: Payment
  administrationId: string
  relationshipId: string
  managementGate: ManagementGateResult
}

/**
 * One payment row: status/amount/date/method/reference/notes/reportedAt
 * (all read-only), a proof download link when present, and - only for
 * status REPORTED - the Confirm/Reject actions. Each card owns its own
 * useConfirmPayment/useRejectPayment instances, the idiomatic way to get
 * independent per-row pending/error state without shared-mutation-plus-
 * variables-matching complexity (same principle every other per-item
 * mutation in this codebase follows, e.g. ContractCard's own markShared/
 * terminate).
 *
 * CONFIRMED renders PaymentAllocationSummary (allocated/remaining amounts,
 * and either "Aplicar a cargos" or "Pago aplicado completamente") instead of
 * a blanket "not yet applied" disclaimer - this feature now has allocation
 * knowledge (INC-014), so the old always-true disclaimer from before this
 * increment would be actively misleading once allocations exist.
 */
function PaymentCard({ payment, administrationId, relationshipId, managementGate }: PaymentCardProps) {
  const { t } = useTranslation(['payments', 'administration'])
  const queryClient = useQueryClient()
  const confirmPayment = useConfirmPayment()
  const rejectPayment = useRejectPayment()

  const isConfirmPending = confirmPayment.isPending && confirmPayment.variables.paymentId === payment.id
  const isRejectPending = rejectPayment.isPending && rejectPayment.variables.paymentId === payment.id
  const anyPendingForThisCard = isConfirmPending || isRejectPending

  const confirmError =
    confirmPayment.isError && confirmPayment.variables.paymentId === payment.id ? confirmPayment.error : null
  const rejectError =
    rejectPayment.isError && rejectPayment.variables.paymentId === payment.id ? rejectPayment.error : null

  /**
   * usePayments's own onSuccess invalidation only fires for the mutation
   * that actually won the race - on a stale-state 'payment_not_reported'
   * failure, this refetches the list directly so the UI catches up to
   * whatever transition actually applied server-side.
   */
  const handleStaleState = (error: Error) => {
    if (error instanceof PaymentRepositoryError && error.code === 'payment_not_reported') {
      void queryClient.invalidateQueries({ queryKey: paymentQueryKeys.list(administrationId, relationshipId) })
    }
  }

  return (
    <Card className={styles['paymentCard']}>
      <div className={styles['paymentHeader']}>
        <Badge tone={STATUS_TONE[payment.status]}>{t(`status.${payment.status}`)}</Badge>
      </div>
      <p className={cx('text-body-sm', 'tabular-nums')}>{t('card.amount', { amount: formatAmount(payment.amount) })}</p>
      <p className="text-caption text-muted">{t('card.paymentDate', { date: formatDate(payment.paymentDate) })}</p>
      {payment.paymentMethod ? (
        <p className="text-caption text-muted">
          {t('card.paymentMethod', { method: t(`paymentMethod.${payment.paymentMethod}`) })}
        </p>
      ) : null}
      {payment.externalReference ? (
        <p className="text-caption text-muted">
          {t('card.externalReference', { reference: payment.externalReference })}
        </p>
      ) : null}
      {payment.notes ? <p className="text-caption text-muted">{t('card.notes', { notes: payment.notes })}</p> : null}
      <p className="text-caption text-muted">{t('card.reportedAt', { date: formatDateTime(payment.reportedAt) })}</p>
      {payment.proofFileId ? <PaymentProofDownloadButton proofFileId={payment.proofFileId} /> : null}

      {payment.status === 'CONFIRMED' ? (
        <PaymentAllocationSummary
          payment={payment}
          administrationId={administrationId}
          relationshipId={relationshipId}
          managementGate={managementGate}
        />
      ) : null}

      {payment.status === 'REPORTED' ? (
        <div className={styles['actionsRow']}>
          <Button
            type="button"
            size="sm"
            loading={isConfirmPending}
            disabled={managementGate.blocked || anyPendingForThisCard}
            aria-disabled={managementGate.blocked ? 'true' : undefined}
            onClick={() => {
              confirmPayment.mutate(
                { paymentId: payment.id, administrationId, rentalRelationshipId: relationshipId },
                { onError: handleStaleState },
              )
            }}
          >
            {t('card.actions.confirm.cta')}
          </Button>
          {managementGate.blocked ? (
            <p className="text-caption text-muted">{t('administration:managementAccessGate.blocked')}</p>
          ) : null}
          {confirmError ? <Alert tone="danger">{confirmActionErrorMessage(t, confirmError)}</Alert> : null}

          <RejectPaymentAction
            disabled={managementGate.blocked || anyPendingForThisCard}
            blockReasonText={managementGate.blocked ? t('administration:managementAccessGate.blocked') : null}
            isPending={isRejectPending}
            errorMessage={rejectError ? rejectActionErrorMessage(t, rejectError) : null}
            onConfirm={() => {
              rejectPayment.mutate(
                { paymentId: payment.id, administrationId, rentalRelationshipId: relationshipId },
                { onError: handleStaleState },
              )
            }}
          />
        </div>
      ) : null}
    </Card>
  )
}

interface PaymentReportFormProps {
  administrationId: string
  relationshipId: string
}

/**
 * "Reportar un pago" (report_payment). Never gated by useManagementGate -
 * report_payment is authorized by can_view_relationship(), not
 * can_manage_administration() (see this feature's own scope notes on the
 * authorization asymmetry) - a participant/viewer whose management access
 * has expired can still report a new payment, exactly as the backend
 * allows.
 *
 * Upload (usePaymentProofUpload, purpose PAYMENT_PROOF) and report
 * (useReportPayment) are two separate mutations - `uploadedProof` holds the
 * already-uploaded FileMetadata across a retry, same orchestration as
 * RegisterHabitexGeneratedForm/AttachSignedCopyAction in
 * RentalContractsPage. The proof file itself is local component state, not
 * part of the RHF/Zod schema - report_payment's proof is optional, so no
 * file selected simply omits proofFileId.
 */
function PaymentReportForm({ administrationId, relationshipId }: PaymentReportFormProps) {
  const { t } = useTranslation('payments')
  const reportPayment = useReportPayment()
  const uploadProof = usePaymentProofUpload()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedProof, setUploadedProof] = useState<FileMetadata | null>(null)

  const schema = paymentReportFormSchema(t)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentReportFormValues>({
    resolver: zodResolver(schema),
    defaultValues: PAYMENT_REPORT_FORM_DEFAULTS,
  })

  const isPending = uploadProof.isPending || reportPayment.isPending

  const onSubmit = handleSubmit((values) => {
    void (async () => {
      try {
        const uploaded =
          uploadedProof ??
          (selectedFile
            ? await uploadProof.mutateAsync({
                administrationId,
                rentalRelationshipId: relationshipId,
                blob: selectedFile,
                originalName: selectedFile.name,
              })
            : null)
        if (uploaded && !uploadedProof) {
          setUploadedProof(uploaded)
        }

        const baseInput = toReportPaymentInput(values, administrationId, relationshipId)
        await reportPayment.mutateAsync(uploaded ? { ...baseInput, proofFileId: uploaded.id } : baseInput)

        reset(PAYMENT_REPORT_FORM_DEFAULTS)
        setSelectedFile(null)
        setUploadedProof(null)
      } catch {
        // reportPayment.isError / uploadProof.isError already reflect the
        // failure - nothing else to do here.
      }
    })()
  })

  const errorMessage = reportPayment.isError
    ? reportPaymentErrorMessage(t, reportPayment.error)
    : uploadProof.isError
      ? t('reportForm.errors.unknown')
      : null

  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event)
      }}
      noValidate
      className={styles['form']}
    >
      <Input
        type="number"
        min={0}
        step="any"
        label={t('reportForm.amount.label')}
        error={errors.amount?.message}
        disabled={isPending}
        {...register('amount')}
      />
      <Input
        type="date"
        label={t('reportForm.paymentDate.label')}
        error={errors.paymentDate?.message}
        disabled={isPending}
        {...register('paymentDate')}
      />
      <Select label={t('reportForm.paymentMethod.label')} disabled={isPending} {...register('paymentMethod')}>
        <option value="">{t('reportForm.paymentMethod.none')}</option>
        {PAYMENT_METHOD_OPTIONS.map((method) => (
          <option key={method} value={method}>
            {t(`reportForm.paymentMethod.${method}`)}
          </option>
        ))}
      </Select>
      <Input
        type="text"
        label={t('reportForm.externalReference.label')}
        disabled={isPending}
        {...register('externalReference')}
      />
      <Textarea label={t('reportForm.notes.label')} disabled={isPending} {...register('notes')} />
      <Input
        type="file"
        label={t('reportForm.proofFile.label')}
        disabled={isPending}
        onChange={(event) => {
          setSelectedFile(event.target.files?.[0] ?? null)
          setUploadedProof(null)
        }}
      />
      <Button type="submit" loading={isPending} disabled={isPending} className={styles['submit']}>
        {isPending ? t('reportForm.submitting') : t('reportForm.submit')}
      </Button>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
    </form>
  )
}

export interface RentalPaymentsViewProps {
  administrationId: string
  relationshipId: string
}

/**
 * The real page body, mounted only once administrationId is resolved (same
 * split as RentalContractsView/RentalChargesView). Resolves the relationship
 * from the already-fetched administration rentals list (no getById - same
 * reasoning as RentalContractsPage/RentalChargesPage) and reads this
 * relationship's payments.
 *
 * The payment list and the report form stay fully visible/usable regardless
 * of expired management access - payments_select/report_payment RLS only
 * require can_view_relationship(), not management access (see this
 * feature's own scope notes on the authorization asymmetry). Only Confirm/
 * Reject, inside PaymentCard, are gated by useManagementGate.
 */
function RentalPaymentsView({ administrationId, relationshipId }: RentalPaymentsViewProps) {
  const { t } = useTranslation(['payments', 'administration'])
  const rentalsQuery = useRentals(administrationId)
  const paymentsQuery = usePayments(administrationId, relationshipId)
  const managementGate = useManagementGate(administrationId)

  if (rentalsQuery.isLoading || paymentsQuery.isLoading) {
    return (
      <div className={styles['page']} data-testid="rental-payments-loading">
        <Skeleton height={32} width={240} />
        <Skeleton height={160} radius="lg" />
        <Skeleton height={160} radius="lg" />
      </div>
    )
  }

  if (rentalsQuery.isError || paymentsQuery.isError) {
    return (
      <div className={styles['page']}>
        <Alert tone="danger" title={t('errors.paymentsTitle')}>
          {t('errors.paymentsDescription')}
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

  const payments = paymentsQuery.data ?? []

  return (
    <div className={styles['page']}>
      <h1 className="text-h2">{t('title')}</h1>
      <p className="text-body-sm text-muted">{t('description')}</p>

      <section className={styles['section']}>
        {payments.length === 0 ? (
          <EmptyState icon={<WalletIcon size={24} />} title={t('empty.title')} description={t('empty.description')} />
        ) : (
          <div className={styles['list']}>
            {payments.map((payment) => (
              <PaymentCard
                key={payment.id}
                payment={payment}
                administrationId={administrationId}
                relationshipId={relationshipId}
                managementGate={managementGate}
              />
            ))}
          </div>
        )}
      </section>

      <section className={styles['reportSection']}>
        <h2 className="text-h3">{t('reportForm.title')}</h2>
        <PaymentReportForm administrationId={administrationId} relationshipId={relationshipId} />
      </section>
    </div>
  )
}

/**
 * /rentals/:id/payments - a narrow, single-purpose page (same principle as
 * RentalContractsPage/RentalChargesPage, explicitly not a general rental
 * detail view) for reporting payments, confirming/rejecting them
 * (report_payment / confirm_payment / reject_payment), and applying a
 * CONFIRMED payment against its rental relationship's charges
 * (allocate_payment - see PaymentAllocationSummary/PaymentAllocationSection
 * above). No allocation edit/delete/reversal (no such RPC exists), no
 * receipt issuance, no edit/delete of a payment itself - see this feature's
 * own scope notes.
 */
export default function RentalPaymentsPage() {
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
      <div className={styles['page']} data-testid="rental-payments-loading">
        <Skeleton height={32} width={240} />
        <Skeleton height={160} radius="lg" />
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

  return <RentalPaymentsView administrationId={currentAdministration.administration.id} relationshipId={id} />
}
