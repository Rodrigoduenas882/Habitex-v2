/// <reference types="vite/client" />

/**
 * Injected by vite.config.ts's `define` as a literal `true`/`false` (an
 * esbuild textual substitution, not a runtime `import.meta.env` member) so
 * that `__ENABLE_PROPERTIES_PREVIEW__ ? lazy(() => import(...)) : null` can
 * be dead-code-eliminated in a normal production build - see
 * UiPreviewPage.tsx and vite.config.ts for the full rationale.
 */
declare const __ENABLE_PROPERTIES_PREVIEW__: boolean
