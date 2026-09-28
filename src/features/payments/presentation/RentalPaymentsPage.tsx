import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation, type UseTranslationResponse } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useActiveAdministration } from '@/features/administration/application/useActiveAdministration'
import { useManagementGate, type ManagementGateResult } from '@/features/administration/application/useManagementGate'
import { AdministrationPicker } from '@/features/administration/presentation/AdministrationPicker'
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
  PAYMENT_REPORT_FORM_DEFAULTS,
  paymentReportFormSchema,
  toReportPaymentInput,
  type PaymentReportFormValues,
} from './payment-report-form'
import { paymentQueryKeys } from '../application/payment-query-keys'
import { useConfirmPayment } from '../application/useConfirmPayment'
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
 * CONFIRMED renders an explicit disclaimer that the payment has not been
 * applied to any charge - this feature has zero knowledge of
 * charges/charge_balances/payment_allocations, and must never imply
 * otherwise (named acceptance criterion - see this feature's own scope
 * notes).
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

      {payment.status === 'CONFIRMED' ? <Alert tone="info">{t('card.confirmedNotApplied')}</Alert> : null}

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
 * detail view) for reporting payments and confirming/rejecting them
 * (report_payment / confirm_payment / reject_payment). No payment
 * allocations, no receipt issuance, no edit/delete of a payment - see this
 * feature's own scope notes.
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
