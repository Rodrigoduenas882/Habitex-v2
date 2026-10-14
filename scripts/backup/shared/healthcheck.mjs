// Minimal healthchecks.io client. Pings /start when the backup run begins,
// then either a plain success ping or /fail, exactly matching
// healthchecks.io's own documented ping API
// (https://healthchecks.io/docs/http_api/) - no new dependency, this is
// three `fetch` calls.
//
// Restriction honored deliberately, not by omission: the ping body never
// carries anything tenant-identifying - no object paths, no administration
// ids, no per-object checksums, no file names. Only aggregate counts and
// run metadata that are already the same shape as the non-sensitive summary
// manifests this pipeline already produces (see
// docs/ops/storage-backup-validation-findings.md §4 and
// docs/ops/backup-automation-findings.md for what "non-sensitive" means
// here and why). The check URL itself (which embeds a UUID) is the one
// genuinely sensitive value in this module - treated as a secret, read
// from an environment variable, never logged.

function redactUrl(url) {
  // The UUID in a healthchecks.io ping URL functions like a bearer token -
  // never put it in a log line, even at debug level.
  return url.replace(/\/ping\/[0-9a-f-]+/i, '/ping/<redacted>')
}

export function createHealthcheckClient({ pingUrl }) {
  if (!pingUrl) {
    // A healthcheck is a monitoring nicety, not a correctness requirement -
    // the backup pipeline's own completeness/integrity checks are what
    // actually gate success. Silently no-op rather than fail the whole run
    // over a missing monitoring URL.
    return {
      async start() {},
      async success() {},
      async fail() {},
    }
  }

  async function ping(suffix, body) {
    try {
      await fetch(`${pingUrl}${suffix}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch (err) {
      // A healthcheck ping failing to send must never fail the backup run
      // itself - log the redacted URL only, never the raw one.
      console.error(`healthcheck ping to ${redactUrl(pingUrl)}${suffix} failed: ${err.message}`)
    }
  }

  return {
    start: () => ping('/start'),
    success: (summary) => ping('', summary),
    fail: (summary) => ping('/fail', summary),
  }
}

/**
 * Strips a combined backup summary down to exactly the non-sensitive
 * aggregate fields safe to send to an external monitoring service -
 * never the caller's full summary object as-is, so a future field added
 * to that summary doesn't silently start leaking here too.
 */
export function toHealthcheckPayload(combinedSummary) {
  return {
    runId: combinedSummary.runId,
    completeness: combinedSummary.completeness,
    postgres: { completeness: combinedSummary.postgres?.completeness },
    storage: {
      completeness: combinedSummary.storage?.completeness,
      objectCount: combinedSummary.storage?.objectCount,
      downloadedCount: combinedSummary.storage?.downloadedCount,
      missingCount: combinedSummary.storage?.missingCount,
    },
  }
}
