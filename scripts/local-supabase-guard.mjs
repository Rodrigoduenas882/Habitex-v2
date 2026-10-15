// Shared, dependency-free guard logic for every local-only Supabase check
// in this repo (visual E2E build/preview, functional E2E config + spec).
// One source of truth so a future fix only needs to happen once.

/**
 * Independent review (MEDIUM, fixed): a plain `url.includes('127.0.0.1')`
 * substring check accepts a crafted host like
 * `https://127.0.0.1.example.com` - a real, resolvable, non-local domain
 * that merely contains the substring. Strict `URL` parsing + exact
 * hostname equality (never `.includes`/`.startsWith`) closes this.
 */
export function isStrictlyLocalSupabaseUrl(rawUrl) {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:') return false
  return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
}

/**
 * Independent review (HIGH, fixed): the functional E2E suite signs up a
 * real user and writes real property/rental rows - unlike the visual
 * suite, which only ever reads a pre-seeded account. A plain
 * "is this 127.0.0.1" check cannot tell the shared, long-running local dev
 * stack (`supabase/config.toml`'s own committed port, used by `supabase
 * start` with no --workdir) apart from a disposable, single-use stack
 * started in a scratch directory - both are "local". A developer who
 * forgets to export override env vars would otherwise silently write real
 * test data into the shared dev stack, because `.env.e2e-local` already
 * holds valid credentials for it.
 *
 * Fix, in layers, ALL required before any signUp/write is attempted:
 *   1. Strict parse (isStrictlyLocalSupabaseUrl above) - exact host, not substring.
 *   2. A SECOND, independently-sourced env var (`E2E_FUNCTIONAL_SUPABASE_PORT`)
 *      that must literally restate the same port number already present in
 *      the URL. This variable does not exist anywhere in `.env.e2e-local` -
 *      forgetting to configure a disposable stack means this check is
 *      simply undefined, a loud failure, not a silent fallback to shared
 *      dev-stack credentials that happen to already be on disk.
 *   3. The target port is compared against the REAL, currently-committed
 *      port in this repo's own `supabase/config.toml` (read live, not a
 *      hardcoded literal that could drift) - that number IS, by
 *      definition, the shared dev stack's port. An exact match is refused
 *      by name, not just silently rejected as "not matching an allowlist".
 *   4. A real network round-trip to the target's own `/auth/v1/health`
 *      endpoint, BEFORE any signUp call - proves the endpoint is alive and
 *      is genuinely a Supabase Auth (GoTrue) instance, not a typo'd dead
 *      port or an unrelated local service that happens to also be on
 *      127.0.0.1.
 *
 * Throws with a specific, named reason on any failure - callers should let
 * this propagate (never swallow it) so the suite fails closed before
 * touching the target at all.
 */
export async function assertDisposableSupabaseStack({
  url,
  declaredPort,
  sharedConfigTomlText,
}) {
  if (!isStrictlyLocalSupabaseUrl(url)) {
    throw new Error(
      `VITE_SUPABASE_URL ("${url}") is not a strictly-local (http://127.0.0.1 or http://localhost) address. ` +
        'Refusing to run the functional E2E suite against anything else.',
    )
  }
  const parsed = new URL(url)
  const actualPort = Number(parsed.port)
  if (!Number.isInteger(actualPort) || actualPort <= 0) {
    throw new Error(`VITE_SUPABASE_URL ("${url}") has no valid port - cannot verify stack isolation.`)
  }

  if (!declaredPort) {
    throw new Error(
      'E2E_FUNCTIONAL_SUPABASE_PORT is not set. This variable has no fallback in .env.e2e-local on purpose - ' +
        'it must be set explicitly, by hand, to the exact port of the DISPOSABLE Supabase stack you started ' +
        'for this run, so forgetting to configure one fails loudly instead of silently reusing the shared ' +
        'dev stack\'s already-valid credentials. Start one with: `supabase start --workdir <a scratch ' +
        'directory OUTSIDE this repo>`, using a copy of supabase/config.toml with a different project_id ' +
        'and every port shifted away from the shared stack\'s own (see [api]/[db]/[studio]/etc. ports in ' +
        'supabase/config.toml) - then export VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, and ' +
        'E2E_FUNCTIONAL_SUPABASE_PORT (same port number as in VITE_SUPABASE_URL, stated twice) before running.',
    )
  }
  if (Number(declaredPort) !== actualPort) {
    throw new Error(
      `E2E_FUNCTIONAL_SUPABASE_PORT ("${declaredPort}") does not match the port in VITE_SUPABASE_URL ` +
        `("${actualPort}"). Both must independently agree on the disposable stack's real port.`,
    )
  }

  const sharedApiPortMatch = /\n\[api\]([\s\S]*?)(?=\n\[|$)/.exec(`\n${sharedConfigTomlText}`)
  const sharedPort = sharedApiPortMatch ? /port\s*=\s*(\d+)/.exec(sharedApiPortMatch[1])?.[1] : undefined
  if (!sharedPort) {
    throw new Error("Could not read the shared dev stack's [api] port from supabase/config.toml - refusing to proceed without being able to compare against it.")
  }
  if (actualPort === Number(sharedPort)) {
    throw new Error(
      `Port ${actualPort} is the SHARED local dev stack's own committed port (supabase/config.toml [api] ` +
        'port) - refusing to run the functional E2E suite against it. Use a disposable stack on a ' +
        'different port instead.',
    )
  }

  // Second independent review (MEDIUM, fixed): no timeout meant a target
  // port that's open but never responds (mid-startup, a stale/half-dead
  // container, anything non-HTTP listening there) could hang this check
  // indefinitely - directly undermining "fails loudly before touching the
  // target", confirmed by reproducing it against a bare TCP listener that
  // accepts the connection but never writes a response.
  let health
  try {
    health = await fetch(new URL('/auth/v1/health', url), { signal: AbortSignal.timeout(5000) })
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'TimeoutError'
    throw new Error(
      isTimeout
        ? `Timed out after 5s waiting for ${url}/auth/v1/health to respond - the disposable stack does not ` +
          'appear to be running, or is stuck mid-startup.'
        : `Could not reach ${url}/auth/v1/health (${error instanceof Error ? error.message : String(error)}) - ` +
          'the disposable stack does not appear to be running.',
    )
  }
  if (!health.ok) {
    throw new Error(`${url}/auth/v1/health responded with HTTP ${health.status} - the disposable stack is not healthy.`)
  }
  const body = await health.json().catch(() => null)
  if (!body || typeof body !== 'object' || !('name' in body) || !String(body.name).toLowerCase().includes('gotrue')) {
    throw new Error(
      `${url}/auth/v1/health did not identify itself as GoTrue/Supabase Auth (got: ${JSON.stringify(body)}) - ` +
        'refusing to treat this as a verified disposable Supabase stack.',
    )
  }
}
