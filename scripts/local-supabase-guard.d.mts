/**
 * Type declarations for local-supabase-guard.mjs, colocated so TypeScript's
 * NodeNext module resolution picks them up automatically for a `.mjs`
 * specifier (requires a matching `.d.mts`, not a plain `.d.ts`). Keeps the
 * runtime module itself as plain, dependency-free JS while still giving
 * every import site (playwright.e2e-local.config.ts,
 * playwright.e2e-functional.config.ts, create-property-and-rental.spec.ts)
 * real type-checking instead of an implicit `any` - second independent
 * review (MEDIUM, fixed): confirmed via a standalone `tsc --noEmit` run
 * that these call sites previously type-checked with no visibility into
 * this module's actual signatures at all.
 */

/** Strict local-only check: exact hostname equality (127.0.0.1/localhost) and http: protocol - never a substring match. */
export declare function isStrictlyLocalSupabaseUrl(rawUrl: string): boolean

export interface AssertDisposableSupabaseStackOptions {
  /** The candidate Supabase API URL to verify, e.g. from VITE_SUPABASE_URL. */
  url: string
  /** The operator-declared port, e.g. from E2E_FUNCTIONAL_SUPABASE_PORT - must match the port embedded in `url`. */
  declaredPort: string | undefined
  /** The real, live text content of this repo's own supabase/config.toml, used to read the shared dev stack's actual committed [api] port. */
  sharedConfigTomlText: string
}

/**
 * Throws (never returns a boolean) if the target cannot be proven to be a
 * disposable, isolated Supabase stack distinct from the shared local dev
 * stack. Performs a real network round-trip (with a 5s timeout) before
 * resolving - callers must await this before any signup/write.
 */
export declare function assertDisposableSupabaseStack(
  options: AssertDisposableSupabaseStackOptions,
): Promise<void>
