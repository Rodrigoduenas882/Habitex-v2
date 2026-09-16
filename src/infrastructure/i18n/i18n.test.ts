import { describe, expect, it } from 'vitest'
import authEsCO from './locales/es-CO/auth.json'
import commonEsCO from './locales/es-CO/common.json'
import i18n from './i18n'

describe('i18n bootstrap', () => {
  it('initializes with es-CO as the active locale and es as fallback', () => {
    expect(i18n.language).toBe('es-CO')
    expect(i18n.options.fallbackLng).toEqual(['es'])
  })

  it('resolves translations for every namespace the Foundation uses', () => {
    expect(i18n.t('common:loading')).toBe(commonEsCO.loading)
    expect(i18n.t('auth:login.title')).toBe(authEsCO.login.title)
  })

  it('interpolates dynamic values without translating them', () => {
    expect(i18n.t('common:home.foundationOk', { session: 'user@example.com' })).toBe(
      'Foundation OK. Sesión activa: user@example.com',
    )
  })
})
