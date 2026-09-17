import { describe, expect, it } from 'vitest'
import { getDisplayNameFromEmail } from './getDisplayNameFromEmail'

describe('getDisplayNameFromEmail', () => {
  it('capitalizes the first token of the local part', () => {
    expect(getDisplayNameFromEmail('rodrigo@habitex.app')).toBe('Rodrigo')
  })

  it('splits on dots, underscores and hyphens and keeps the first token', () => {
    expect(getDisplayNameFromEmail('rodrigo.duenas@gmail.com')).toBe('Rodrigo')
    expect(getDisplayNameFromEmail('rodrigo_duenas@gmail.com')).toBe('Rodrigo')
    expect(getDisplayNameFromEmail('rodrigo-duenas@gmail.com')).toBe('Rodrigo')
  })

  it('normalizes an all-caps or mixed-case local part', () => {
    expect(getDisplayNameFromEmail('RODRIGO@habitex.app')).toBe('Rodrigo')
    expect(getDisplayNameFromEmail('rOdRigO@habitex.app')).toBe('Rodrigo')
  })

  it('returns null for missing or empty input', () => {
    expect(getDisplayNameFromEmail(null)).toBeNull()
    expect(getDisplayNameFromEmail(undefined)).toBeNull()
    expect(getDisplayNameFromEmail('')).toBeNull()
  })

  it('returns null when the local part has no usable token (e.g. "@habitex.app")', () => {
    expect(getDisplayNameFromEmail('@habitex.app')).toBeNull()
  })
})
