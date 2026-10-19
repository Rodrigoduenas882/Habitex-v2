/**
 * The userId actually confirmed as a password-recovery identity for this
 * tab, or null when no recovery session is currently trusted. Module-level
 * (not a React ref) on purpose: it must survive a component
 * unmount/remount (navigating away from /reset-password and back within
 * the same tab, no full reload) so a LATER, unrelated identity can be
 * compared against what was originally confirmed - a React ref local to
 * one hook instance would reset on every remount and lose that history.
 *
 * Follow-up to an independent review (HIGH, fixed once already in
 * useRecoverySession by pinning the identity for as long as a single hook
 * instance stays mounted) that was still incomplete: without this module
 * surviving remounts and being actively CLEARED on a later, unrelated
 * identity change (AuthSessionListener's job - see its own doc comment),
 * a user could navigate away from /reset-password, sign out, sign back in
 * as anyone else, then navigate back to /reset-password and have it
 * resolve 'ready' again for that new, unrelated session - a fresh mount
 * has no memory of the earlier mount's pinned ref.
 */
let confirmedRecoveryUserId: string | null = null

export function setConfirmedRecoveryUserId(userId: string | null): void {
  confirmedRecoveryUserId = userId
}

export function getConfirmedRecoveryUserId(): string | null {
  return confirmedRecoveryUserId
}

/**
 * pageLoadedFromPasswordRecoveryLink (client.ts) is a plain boolean that
 * never changes for the rest of the tab's lifetime - by itself it would let
 * a stale "yes, this tab's original load had a recovery hash" fact be
 * reused to pin a BRAND NEW, unrelated identity, however many times
 * /reset-password gets remounted later (e.g. after the originally-pinned
 * identity was already cleared by a normal, unrelated sign-in - see
 * AuthSessionListener). A genuinely new recovery attempt always arrives via
 * a fresh page load from the emailed link (which resets this module from
 * scratch), so this one-time gate never needs to be "re-armed" within a
 * single continuous tab lifetime - only ever consumed once.
 */
let urlSignalConsumed = false

export function consumeUrlRecoverySignalOnce(): boolean {
  if (urlSignalConsumed) {
    return false
  }
  urlSignalConsumed = true
  return true
}
