import { useTranslation } from 'react-i18next'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import type { RentalRelationship, RentalStatus } from '../domain/rental.types'
import styles from './RentalListCard.module.css'

export interface RentalListCardProps {
  rental: RentalRelationship
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
export function RentalListCard({ rental }: RentalListCardProps) {
  const { t } = useTranslation('rentals')

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
    </Card>
  )
}
