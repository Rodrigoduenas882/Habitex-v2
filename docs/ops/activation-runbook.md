# Backup system activation runbook (INC-BKP-005)

This is a **checklist for a human**, to be followed in order, the first
time the backup pipeline is pointed at real infrastructure. Nothing in
this document has been executed — no real Cloudflare account, R2 bucket,
GitHub secret, or healthchecks.io check exists as of this increment. Every
step below requires the named human action; none of it happens by running
a script.

## 0. Before starting anything here

Confirm, don't assume:
- `docs/ops/backup-reader-role-findings.md` — `backup_reader`'s migration
  exists and is validated locally, **not yet applied to the remote
  project**.
- `docs/ops/disaster-recovery-validation-findings.md` — full local
  recovery is validated end-to-end, including the two real findings fixed
  there (summary-manifest upload, the `x-upsert: true` Storage restore
  requirement).
- D1 is **not** resolved by anything in this runbook alone — it is
  resolved only once a real backup has actually run successfully against
  the real project and been verified restorable, which this runbook ends
  just short of (see §7, the explicit human checkpoint).

## 1. Apply the `backup_reader` migration to the remote project

**Human action, separate from everything else in this list**: review
`supabase/migrations/20261013120000_create_backup_reader_role.sql` one
more time, then apply it to the real project (Supabase dashboard SQL
editor, or `supabase db push` once a human has confirmed the diff). Set
`backup_reader`'s real password immediately after, via the dashboard —
**never** in a migration, **never** in this repo.

## 2. Create the Cloudflare R2 bucket and its credentials

1. Create the R2 bucket (name of your choice; the pipeline's own key
   layout, `<runId>/<runId>.<leg>.<ext>` and matching summary files,
   works in any bucket).
2. Create an R2 API token scoped to **exactly this bucket**, with Object
   Read & Write (R2 cannot express "write without delete" as a separate
   permission — this is expected, not a gap to work around with token
   scoping; the real protection is the Bucket Lock in step 3).
3. Record: endpoint URL, access key id, secret access key, bucket name.
   These become `BACKUP_R2_ENDPOINT`/`BACKUP_R2_ACCESS_KEY_ID`/
   `BACKUP_R2_SECRET_ACCESS_KEY`/`BACKUP_R2_BUCKET` (step 5).

## 3. Configure the R2 Bucket Lock

Per `docs/ops/disaster-recovery-validation-findings.md` §9's retention
design: an **8-day** lock, applied to the whole bucket (this pipeline
does not use per-prefix lifecycle rules — one lock, one bucket, both legs
share it). Configure via the Cloudflare dashboard's Object Lifecycle /
Object Lock settings for the bucket created in step 2.

## 4. Create two independent age identities for real recovery

**Not** the throwaway test identities used throughout INC-BKP-003 through
INC-BKP-005 (`age-keygen` run during this session, private keys only ever
in this machine's scratchpad, never committed). For real activation:

1. Generate 2 **new** identities (`age-keygen`), on two **separate**
   machines/people if your organization's recovery model calls for that —
   the pipeline only ever needs the 2 **public** keys.
2. The 2 public keys become `BACKUP_AGE_RECIPIENTS` (comma-separated,
   step 5).
3. The 2 **private** keys are held by whoever is designated to perform a
   real recovery — never stored in this repo, never as a GitHub secret
   (a GitHub secret is for the backup job's own use; recovery is a human
   action performed with a human-held key, by design — the backup
   pipeline itself only ever encrypts, never decrypts).

## 5. Create healthchecks.io check (optional, but recommended)

1. Create a check on healthchecks.io for this backup job.
2. Its ping URL becomes `BACKUP_HEALTHCHECKS_PING_URL`.
3. If skipped, `shared/healthcheck.mjs` no-ops — the pipeline still works,
   just without external monitoring.

## 6. Create the GitHub repository secrets and variable

| Name | Value | Type |
|---|---|---|
| `BACKUP_PGHOST` | Real project's Postgres host | Secret |
| `BACKUP_PGPORT` | Real project's Postgres port | Secret |
| `BACKUP_PGDATABASE` | Real project's database name | Secret |
| `BACKUP_PGUSER` | `backup_reader` | Secret |
| `BACKUP_PGPASSWORD` | The password set in step 1 | Secret |
| `BACKUP_SUPABASE_URL` | Real project's URL | Secret |
| `BACKUP_SUPABASE_SERVICE_ROLE_KEY` | Real project's `service_role` key | Secret |
| `BACKUP_AGE_RECIPIENTS` | The 2 public keys from step 4 | Secret |
| `BACKUP_R2_ENDPOINT` | From step 2 | Secret |
| `BACKUP_R2_ACCESS_KEY_ID` | From step 2 | Secret |
| `BACKUP_R2_SECRET_ACCESS_KEY` | From step 2 | Secret |
| `BACKUP_R2_BUCKET` | From step 2 | Secret |
| `BACKUP_HEALTHCHECKS_PING_URL` | From step 5, if used | Secret |
| `BACKUP_AUTOMATION_ENABLED` | `"true"`, only once everything above is done | **Variable**, not secret |

This runbook does **not** set any of these — this increment's own
restrictions forbid modifying GitHub secrets/variables. Listed here so a
human doing the activation has the exact, complete set in one place.

## 7. The human checkpoint: one real manual run, gated and observed

Before `BACKUP_AUTOMATION_ENABLED` is ever set to `"true"` (and even then,
only via a manual `workflow_dispatch` typing `RUN` — the cron stays
commented out, see `.github/workflows/backup.yml`'s own Gate 1):

1. Trigger exactly **one** manual run.
2. Watch it complete (the workflow's own stdout, plus the healthchecks.io
   ping if configured).
3. **Verify the result is independently selectable for restore** — run
   `scripts/backup/shared/select-snapshot.mjs`'s check (via a small
   script, or `recover-from-destination.mjs` pointed at the real bucket)
   against the real run id it produced, using the real R2 credentials
   read-only. Confirm it reports eligible, not just that the workflow
   exited 0.
4. **Do not yet perform a real restore against the production project**
   from this first run — recovering bytes (read-only against R2) and
   restoring them into a live database are different risk levels; the
   first is enough to prove the pipeline works, the second should wait
   for a deliberate DR drill scheduled on its own terms.
5. Only after step 3 passes does this runbook consider the "first real
   external backup" criterion (below) met.

## 8. Testing the SigV4 connection against real R2 (step 11)

Everything in INC-BKP-004/005 validated `shared/s3-client.mjs`'s SigV4
signing against `shared/mock-r2-server.mjs`'s own independent signature
verification — real HMAC/canonical-request math, proven correct against
a second implementation of the same algorithm, but never against an
actual R2 endpoint. To close that gap at the human checkpoint (step 7),
before relying on it for anything:

```bash
# Minimal real-connection smoke test - run manually, once, with the real
# credentials from step 2, pointed at the real bucket. Uploads and reads
# back one small, clearly-labeled test object; does not touch the backup
# pipeline's own run-id namespace.
node -e "
import('./scripts/backup/shared/s3-client.mjs').then(async ({ createS3Client }) => {
  const client = createS3Client({
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
  });
  const key = 'connectivity-smoke-test/' + Date.now() + '.txt';
  await client.putObject(key, Buffer.from('habitex r2 connectivity smoke test'));
  const back = await client.getObject(key);
  console.log('round-trip OK:', back.toString() === 'habitex r2 connectivity smoke test');
});
"
```

If this fails with a signature error against real R2 but succeeds against
the mock, the most likely causes, in order of likelihood: the bucket name
in the path doesn't match what the token is scoped to; the endpoint host
format is wrong (R2 uses `https://<account-id>.r2.cloudflarestorage.com`,
not a bucket-specific subdomain for the S3 API); or the account's R2
region isn't `"auto"` in some non-default configuration. Diagnose by
comparing the exact canonical request R2 reports in its error (if any)
against what `s3-client.mjs`'s `signRequest()` would have built for the
same request — do not guess; re-derive it by hand once, the same way
`mock-r2-server.mjs`'s own independent verifier does.

## 9. Criteria for declaring the first real external backup authorized

All of the following, not any subset:

- [ ] `backup_reader` applied to the remote project (step 1), password set
  out-of-band, never committed.
- [ ] R2 bucket + Bucket Lock configured (steps 2–3).
- [ ] 2 real age identities generated, public keys recorded, private keys
  held only by designated humans (step 4).
- [ ] All secrets in §6's table set in GitHub.
- [ ] The step 8 connectivity smoke test passed against the real bucket.
- [ ] A human has reviewed this entire runbook and the disaster-recovery
  findings document and explicitly approves proceeding.
- [ ] `BACKUP_AUTOMATION_ENABLED` is set to `"true"` **only** immediately
  before the one gated manual run in step 7 — never set it and leave it
  set "just in case," since the cron trigger (currently commented out)
  becoming active in the future would otherwise run unattended the moment
  that file is uncommented and merged.

Even once all of the above are true, this still only authorizes **one
observed, manual run** (step 7) — not turning on the schedule. Enabling
the cron is a separate, later decision, made only after that one run has
been independently verified restorable.
