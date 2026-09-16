import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import authEsCO from './locales/es-CO/auth.json'
import commonEsCO from './locales/es-CO/common.json'
import uiPreviewEsCO from './locales/es-CO/uiPreview.json'
import authEs from './locales/es/auth.json'
import commonEs from './locales/es/common.json'
import uiPreviewEs from './locales/es/uiPreview.json'

/**
 * Habitex MVP starts in Colombia: es-CO is the active locale, es is the
 * fallback (used only for keys missing from es-CO). Adding another locale
 * (e.g. en-US) later means adding a resources entry here - components never
 * change, they only ever call useTranslation().
 */
export const defaultNS = 'common'

export const resources = {
  'es-CO': { common: commonEsCO, auth: authEsCO, uiPreview: uiPreviewEsCO },
  es: { common: commonEs, auth: authEs, uiPreview: uiPreviewEs },
} as const

void i18next.use(initReactI18next).init({
  resources,
  lng: 'es-CO',
  fallbackLng: 'es',
  defaultNS,
  ns: ['common', 'auth', 'uiPreview'],
  interpolation: {
    // React already escapes interpolated values.
    escapeValue: false,
  },
  returnNull: false,
})

export default i18next
