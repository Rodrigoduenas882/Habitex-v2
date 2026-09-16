import 'i18next'
import type auth from './locales/es-CO/auth.json'
import type common from './locales/es-CO/common.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      common: typeof common
      auth: typeof auth
    }
  }
}
