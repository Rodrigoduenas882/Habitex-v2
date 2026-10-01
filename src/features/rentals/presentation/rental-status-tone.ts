import type { BadgeTone } from '@/shared/ui/Badge'
import type { RentalStatus } from '../domain/rental.types'

/**
 * Existing semantic tones only (see DESIGN.md) - no new palette. ACTIVE is
 * the one state that's unambiguously positive; ENDING gets a warning
 * (something to pay attention to); DRAFT/ENDED are both non-urgent, plain
 * states; CANCELLED is the one outcome closest to "stopped/negative".
 *
 * Shared between RentalListCard and RentalContextHeader (DS-002) - both
 * render the exact same status Badge for a rental relationship, so this
 * mapping lives in one place rather than being redefined (and risking
 * drifting) in each.
 */
export const RENTAL_STATUS_TONE: Record<RentalStatus, BadgeTone> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  ENDING: 'warning',
  ENDED: 'neutral',
  CANCELLED: 'danger',
}
