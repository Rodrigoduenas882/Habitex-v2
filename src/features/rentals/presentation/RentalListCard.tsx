import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@/shared/ui/Alert'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import type {
  RentalActivationErrorCode,
  RentalLifecycleErrorCode,
  RentalRelationship,
  RentalStatus,
} from '../domain/rental.types'
import styles from './RentalListCard.module.css'

/** Why the Activate button is currently disabled - null when it isn't. */
export type RentalActivationBlockReason = 'managementAccess' | 'capacity' | 'termsIncomplete' | null

export interface RentalListCardActivation {
  disabled: boolean
  blockReason: RentalActivationBlockReason
  isPending: boolean
  errorCode: RentalActivationErrorCode | null
  onActivate: () => void
}

/** Why the Cancelar action is currently disabled - null when it isn't. The
 * only reachable reason on the frontend is expired management access
 * (cancel_draft_rental is the one lifecycle RPC gated by
 * can_manage_administration(), same as activate). */
export type RentalCancelBlockReason = 'managementAccess' | null

export interface RentalListCardCancelDraft {
  disabled: boolean
  blockReason: RentalCancelBlockReason
  isPending: boolean
  errorCode: RentalLifecycleErrorCode | null
  onConfirm: () => void
}

export interface RentalListCardStartEnding {
  isPending: boolean
  errorCode: RentalLifecycleErrorCode | null
  onStartEnding: () => void
}

export interface RentalListCardEndRental {
  isPending: boolean
  errorCode: RentalLifecycleErrorCode | null
  onConfirm: () => void
}

export interface RentalListCardProps {
  rental: RentalRelationship
  /**
   * Only ever rendered for status === 'DRAFT'; omit entirely on pages that
   * don't wire activation (keeps this component usable without gate/mutation
   * plumbing elsewhere).
   */
  activation?: RentalListCardActivation
  /** Only ever rendered for status === 'DRAFT' (cancel_draft_rental). */
  cancelDraft?: RentalListCardCancelDraft
  /** Only ever rendered for status === 'ACTIVE' (start_ending_rental). */
  startEnding?: RentalListCardStartEnding
  /** Only ever rendered for status === 'ENDING' (end_rental). */
  endRental?: RentalListCardEndRental
}

/**
 * Existing semantic tones only (see DESIGN.md) - no new palette. ACTIVE is
 * the one state that's unambiguously positive; ENDING gets a warning
 * (something to pay attention to); DRAFT/ENDED are both non-urgent, plain
 * states; CANCELLED is the one outcome closest to "stopped/negative".
 */
const STATUS_TONE: Record<RentalStatus, BadgeTone> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  ENDING: 'warning',
  ENDED: 'neutral',
  CANCELLED: 'danger',
}

/**
 * One reason-text i18n key per RentalActivationBlockReason - a lookup
 * object instead of a growing ternary chain, since managementAccess lives
 * under a different namespace ('administration') than the other two.
 */
const BLOCK_REASON_KEY = {
  managementAccess: 'administration:managementAccessGate.blocked',
  capacity: 'activate.capacityReasonBlocked',
  termsIncomplete: 'activate.termsIncompleteReasonBlocked',
} as const satisfies Record<Exclude<RentalActivationBlockReason, null>, string>

function formatDate(value: string): string {
  // Stored as a plain date (no time/zone) - parsed at local midnight so it
  // never shifts a day depending on the viewer's timezone.
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`),
  )
}

interface LifecycleConfirmActionProps {
  triggerLabel: string
  confirmLabel: string
  backLabel: string
  disabled: boolean
  blockReasonText: string | null
  isPending: boolean
  errorMessage: string | null
  onConfirm: () => void
}

/**
 * Shared two-step inline confirmation for the two irreversible-negative
 * lifecycle actions (Cancelar -> DRAFT/CANCELLED, Terminar arriendo ->
 * ENDING/ENDED). No new Modal/Dialog primitive - built from Button/Alert
 * only, per this increment's product decision.
 *
 * The first click only flips local `confirming` state - it never calls
 * onConfirm. Once confirming, the single trigger button is replaced by two
 * distinct elements (never the same element relabeled in place) so a
 * screen reader/keyboard user unambiguously encounters new interactive
 * elements. Focus moves to the confirm button on that transition (ref +
 * effect on the confirming boolean - same principle as Tabs' own
 * focus-after-state-change, adapted here because the target element does
 * not exist yet on the click that triggers it, unlike Tabs where the next
 * tab is already rendered).
 */
function LifecycleConfirmAction({
  triggerLabel,
  confirmLabel,
  backLabel,
  disabled,
  blockReasonText,
  isPending,
  errorMessage,
  onConfirm,
}: LifecycleConfirmActionProps) {
  const [confirming, setConfirming] = useState(false)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirming) {
      confirmButtonRef.current?.focus()
    }
  }, [confirming])

  if (!confirming) {
    return (
      <div className={styles['lifecycleRow']}>
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
          {triggerLabel}
        </Button>
        {disabled && blockReasonText ? <p className="text-caption text-muted">{blockReasonText}</p> : null}
      </div>
    )
  }

  return (
    <div className={styles['lifecycleRow']}>
      <div className={styles['confirmActions']}>
        <Button
          ref={confirmButtonRef}
          type="button"
          variant="destructive"
          size="sm"
          loading={isPending}
          disabled={isPending}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setConfirming(false)
          }}
        >
          {backLabel}
        </Button>
      </div>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
    </div>
  )
}

/**
 * Same visual family as PropertyListCard/ParkingListCard (Card, spacing
 * tokens, tone="badge" for the status). No tenant/subject/rent amount yet -
 * this increment only reads rental_relationships itself (see
 * RentalRelationship's own doc comment), so the headline is a neutral,
 * status-derived phrase instead of a fabricated name. status is shown
 * exactly as the backend reports it, never derived from dates.
 */
export function RentalListCard({ rental, activation, cancelDraft, startEnding, endRental }: RentalListCardProps) {
  const { t } = useTranslation(['rentals', 'administration'])
  const navigate = useNavigate()

  const endDate = rental.actualEndDate ?? rental.expectedEndDate

  return (
    <Card className={styles['card']}>
      <p className={styles['title']}>{t(`list.title.${rental.status}`)}</p>
      {rental.realStartDate ? (
        <p className="text-caption text-muted">
          {t('list.startDate', { date: formatDate(rental.realStartDate) })}
        </p>
      ) : null}
      {endDate ? (
        <p className="text-caption text-muted">{t('list.endDate', { date: formatDate(endDate) })}</p>
      ) : null}
      {rental.paymentDay !== null ? (
        <p className="text-caption text-muted">{t('list.paymentDay', { day: rental.paymentDay })}</p>
      ) : null}
      {rental.paymentTiming ? (
        <p className="text-caption text-muted">{t(`paymentTiming.${rental.paymentTiming}`)}</p>
      ) : null}
      <div className={styles['meta']}>
        <Badge tone={STATUS_TONE[rental.status]}>{t(`status.${rental.status}`)}</Badge>
      </div>
      {rental.status === 'DRAFT' ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={styles['termsAction']}
          onClick={() => {
            void navigate(`/rentals/${rental.id}/terms`)
          }}
        >
          {t('list.completeTerms')}
        </Button>
      ) : null}
      {rental.status === 'DRAFT' && activation ? (
        <div className={styles['activateRow']}>
          <Button
            type="button"
            size="sm"
            loading={activation.isPending}
            disabled={activation.disabled}
            aria-disabled={activation.disabled ? 'true' : undefined}
            onClick={activation.onActivate}
          >
            {t('activate.cta')}
          </Button>
          {activation.disabled && !activation.isPending && activation.blockReason ? (
            <p className="text-caption text-muted">{t(BLOCK_REASON_KEY[activation.blockReason])}</p>
          ) : null}
          {activation.errorCode ? (
            <Alert tone="danger">{t(`activate.errors.${activation.errorCode}`)}</Alert>
          ) : null}
        </div>
      ) : null}
      {rental.status === 'DRAFT' && cancelDraft ? (
        <LifecycleConfirmAction
          triggerLabel={t('lifecycle.cancel.cta')}
          confirmLabel={t('lifecycle.cancel.confirmCta')}
          backLabel={t('lifecycle.back')}
          disabled={cancelDraft.disabled}
          blockReasonText={
            !cancelDraft.isPending && cancelDraft.blockReason
              ? t(BLOCK_REASON_KEY[cancelDraft.blockReason])
              : null
          }
          isPending={cancelDraft.isPending}
          errorMessage={cancelDraft.errorCode ? t(`lifecycle.errors.${cancelDraft.errorCode}`) : null}
          onConfirm={cancelDraft.onConfirm}
        />
      ) : null}
      {rental.status === 'ACTIVE' && startEnding ? (
        <div className={styles['lifecycleRow']}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={startEnding.isPending}
            disabled={startEnding.isPending}
            onClick={startEnding.onStartEnding}
          >
            {t('lifecycle.startEnding.cta')}
          </Button>
          {startEnding.errorCode ? (
            <Alert tone="danger">{t(`lifecycle.errors.${startEnding.errorCode}`)}</Alert>
          ) : null}
        </div>
      ) : null}
      {rental.status === 'ENDING' && endRental ? (
        <LifecycleConfirmAction
          triggerLabel={t('lifecycle.end.cta')}
          confirmLabel={t('lifecycle.end.confirmCta')}
          backLabel={t('lifecycle.back')}
          disabled={false}
          blockReasonText={null}
          isPending={endRental.isPending}
          errorMessage={endRental.errorCode ? t(`lifecycle.errors.${endRental.errorCode}`) : null}
          onConfirm={endRental.onConfirm}
        />
      ) : null}
    </Card>
  )
}
