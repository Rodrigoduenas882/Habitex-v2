import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@/shared/ui/Alert'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import type { RentalActivationErrorCode, RentalRelationship, RentalStatus } from '../domain/rental.types'
import styles from './RentalListCard.module.css'

/** Why the Activate button is currently disabled - null when it isn't. */
export type RentalActivationBlockReason = 'managementAccess' | 'capacity' | null

export interface RentalListCardActivation {
  disabled: boolean
  blockReason: RentalActivationBlockReason
  isPending: boolean
  errorCode: RentalActivationErrorCode | null
  onActivate: () => void
}

export interface RentalListCardProps {
  rental: RentalRelationship
  /**
   * Only ever rendered for status === 'DRAFT'; omit entirely on pages that
   * don't wire activation (keeps this component usable without gate/mutation
   * plumbing elsewhere).
   */
  activation?: RentalListCardActivation
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

function formatDate(value: string): string {
  // Stored as a plain date (no time/zone) - parsed at local midnight so it
  // never shifts a day depending on the viewer's timezone.
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`),
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
export function RentalListCard({ rental, activation }: RentalListCardProps) {
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
            <p className="text-caption text-muted">
              {activation.blockReason === 'managementAccess'
                ? t('administration:managementAccessGate.blocked')
                : t('activate.capacityReasonBlocked')}
            </p>
          ) : null}
          {activation.errorCode ? (
            <Alert tone="danger">{t(`activate.errors.${activation.errorCode}`)}</Alert>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}
