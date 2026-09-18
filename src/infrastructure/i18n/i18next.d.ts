import 'i18next'
import type auth from './locales/es-CO/auth.json'
import type common from './locales/es-CO/common.json'
import type dashboard from './locales/es-CO/dashboard.json'
import type properties from './locales/es-CO/properties.json'
import type uiPreview from './locales/es-CO/uiPreview.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      common: typeof common
      auth: typeof auth
      uiPreview: typeof uiPreview
      dashboard: typeof dashboard
      properties: typeof properties
    }
  }
}
