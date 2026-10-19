const STORAGE_PREFIX = 'habitex:payment-report-idempotency:'

function storageKey(rentalRelationshipId: string): string {
  return `${STORAGE_PREFIX}${rentalRelationshipId}`
}

/**
 * Reuses the pending idempotency key for this specific rental relationship's
 * payment-report form if one was already generated - surviving a reload, a
 * lost network response, or a manual retry - or generates and persists a
 * brand-new one otherwise. Scoped per relationship (never global, never per
 * administration alone) so two different forms never share a key by
 * accident.
 *
 * Only the opaque key itself is ever persisted - no amount, date, method or
 * any other financial detail ever touches browser storage.
 * `sessionStorage` (not `localStorage`) is deliberate: a pending report
 * attempt is a short-lived thing that should not outlive the browser tab.
 *
 * Wrapped in try/catch - private browsing, disabled storage or a full quota
 * must never block reporting a payment; it only means this one attempt
 * loses the "survive a reload" property, which is an acceptable degradation,
 * unlike refusing to let the user submit at all.
 */
export function getOrCreatePendingIdempotencyKey(rentalRelationshipId: string): string {
  try {
    const key = storageKey(rentalRelationshipId)
    const existing = sessionStorage.getItem(key)
    if (existing) {
      return existing
    }
    const created = crypto.randomUUID()
    sessionStorage.setItem(key, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

/**
 * Called once report_payment actually succeeds for this relationship's form
 * - clears the pending key so the NEXT report (a genuinely new logical
 * attempt) gets a brand-new one, never reusing a key across two distinct
 * payments.
 */
export function clearPendingIdempotencyKey(rentalRelationshipId: string): void {
  try {
    sessionStorage.removeItem(storageKey(rentalRelationshipId))
  } catch {
    // Same reasoning as getOrCreatePendingIdempotencyKey - never block the UI over storage access.
  }
}
