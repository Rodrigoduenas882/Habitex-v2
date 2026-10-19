import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * pageLoadedFromPasswordRecoveryLink is read once, synchronously, at module
 * evaluation (see client.ts's own doc comment for why) - so exercising both
 * outcomes means setting window.location.hash *before* a fresh import of
 * this module, via vi.resetModules(). A normal single static import (as
 * every other consumer in the app does) would only ever see one value.
 */
describe('pageLoadedFromPasswordRecoveryLink', () => {
  afterEach(() => {
    window.location.hash = ''
    vi.resetModules()
  })

  it('is true when the URL hash carries a recovery link from Supabase', async () => {
    window.location.hash =
      '#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=recovery'

    const { pageLoadedFromPasswordRecoveryLink } = await import('./client')

    expect(pageLoadedFromPasswordRecoveryLink).toBe(true)
  })

  it('is false on an ordinary page load with no hash at all', async () => {
    window.location.hash = ''

    const { pageLoadedFromPasswordRecoveryLink } = await import('./client')

    expect(pageLoadedFromPasswordRecoveryLink).toBe(false)
  })

  it('is false for a different Supabase hash type (e.g. a magic-link sign-in), never a false positive', async () => {
    window.location.hash = '#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=signup'

    const { pageLoadedFromPasswordRecoveryLink } = await import('./client')

    expect(pageLoadedFromPasswordRecoveryLink).toBe(false)
  })
})
