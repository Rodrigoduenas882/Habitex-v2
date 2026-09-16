import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// Without this, RTL doesn't auto-clean between `it()` blocks in the same
// file (its auto-cleanup detection needs Vitest's `globals: true`, which
// this project deliberately doesn't use - tests import from 'vitest'
// explicitly instead), so DOM nodes from earlier tests leak into later ones.
afterEach(() => {
  cleanup()
})

// jsdom doesn't implement matchMedia. Default to "no preference" (light);
// individual tests can override with vi.stubGlobal for specific cases.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
