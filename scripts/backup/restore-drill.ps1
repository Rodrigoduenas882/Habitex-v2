<#
.SYNOPSIS
  INC-BKP-007 recovery drill: restores one PostgreSQL+Storage backup run
  into a DISPOSABLE Docker Postgres container, to validate that a real
  backup can actually be recovered end-to-end - never into production,
  never into the existing local dev stack.

.DESCRIPTION
  What this does, in order, stopping immediately on any failure:
    0. Pre-checks: Docker daemon reachable, repo paths resolvable, `age` on
       PATH, prints the EXISTING containers as a baseline (so you can
       compare before/after).
    1. Select -> cross-check hashes -> decrypt -> verify, via
       scripts/backup/validate-real-recovery.mjs, into a FRESH ephemeral
       directory - read-only against R2.
    2. Inspects the Storage leg's per-object verification result, grouped by
       bucket (counts and bucket names only - never file paths/content).
    3. Boots a BRAND-NEW, uniquely-named, --rm Postgres container (same
       Supabase-flavored image tag the local dev stack uses) on a
       dedicated host port, distinct from the existing stack's. No
       bind-mounted volume - nothing survives after the container is
       removed. This container never receives any production Supabase
       credential - it only talks to itself, locally.
    3.5. Confirms the base image self-initialized the expected base
       schemas/roles before touching real data.
    3.75. Bootstraps Supabase Storage's internal schema
       (storage.buckets/objects/foldername()) via a THROWAWAY
       storage-api helper on its own isolated Docker network (never the
       existing dev stack's network, no published port) - the bare
       postgres image alone never creates these; storage-api
       self-migrates them on first connect.
    3.8. Bootstraps Supabase Auth's internal schema (auth.users' full
       modern column set, including email_confirmed_at, plus every other
       auth.* table) the same way, via a THROWAWAY gotrue helper on the
       SAME isolated network. The bare image's own auth schema is a much
       older/smaller GoTrue version - sufficient for what Habitex's
       *migrations* reference, but NOT for what a real data DUMP
       contains. Both helpers stopped/removed and the shared isolated
       network torn down once both are confirmed. Also raises
       log_min_error_statement and log_error_verbosity on the disposable
       Postgres container (via supabase_admin) before any real data is
       restored, so a later SQL error can never echo real row values into
       this script's own diagnostic logs - the error class itself stays
       fully visible via SQLSTATE.
    4. Replays every file under supabase/migrations/ in order (the same
       mechanism `supabase db reset` uses internally) to build the schema.
    5. Restores the decrypted, data-only dump from step 1 - a REAL
       restoration via `psql -v VERBOSITY=sqlstate`, not a dry run.
    6. Runs scripts/backup/verify-referential-integrity.sql unmodified -
       walks every FK constraint generically, reports only constraint
       names/table names/column names and numeric orphan counts. Never
       row content.
    7. Runs ONLY aggregate row counts per key table (count(*), never
       SELECT *) - this is real production data, so no row content is
       ever requested or displayed by this script.
    8. Cleanup: stops (and removes, --rm) the disposable container,
       deletes the ephemeral decrypted output directory, clears R2
       credentials from the shell - all in a `finally`, runs even on
       failure. Re-prints `docker ps -a` afterward so you can directly
       compare against the step-0 baseline and confirm nothing else
       changed.

  Full procedure, evidence from past runs, and known limitations/open
  questions: docs/ops/real-recovery-drill-plan.md.

.PARAMETER RunId
  The backup run id to validate (e.g. from a GitHub Actions summary) -
  e.g. 20261014T210341Z-a8f4b8.

.PARAMETER ExpectedPostgresSha256
  The PostgreSQL leg's sha256, as reported by the backup run (GitHub
  Actions log/summary) - cross-checked against the summary manifest AND
  the freshly re-downloaded bytes; all three must agree before anything
  else runs.

.PARAMETER ExpectedStorageSha256
  Same, for the Storage leg's archive.

.PARAMETER IdentityFilePath
  Path to ONE of the two real age recovery identity files. Never commit
  this path's target, never paste its contents anywhere. Must not be
  passphrase-protected (age-helpers.mjs's decryptBuffer has no interactive
  terminal left to prompt on - see docs/ops/real-recovery-drill-plan.md
  §6).

.PARAMETER RepoRoot
  Defaults to this script's own repo (resolved from its own location).
  Override only if running a copy of this file outside the repo.

.PARAMETER HostPort
  Host port for the disposable Postgres container. Defaults to 55432,
  distinct from the local dev stack's 54322 so the two never collide.

.EXAMPLE
  .\scripts\backup\restore-drill.ps1 `
    -RunId 20990101T000000Z-000000 `
    -ExpectedPostgresSha256 0000000000000000000000000000000000000000000000000000000000000000 `
    -ExpectedStorageSha256 0000000000000000000000000000000000000000000000000000000000000000 `
    -IdentityFilePath C:\path\to\your\real\age\identity.txt

  (Values above are placeholders, not a real run - copy the actual run id
  and SHA-256 hashes from the backup run you are validating, e.g. its
  GitHub Actions summary.)

.NOTES
  RUN THIS YOURSELF, in your own interactive PowerShell window - never
  paste your R2 secret key or age identity file CONTENTS anywhere, and
  never run this via an AI agent's own tool calls (no real TTY there for
  the masked credential prompts: R2 endpoint/bucket/access key id/secret
  access key are all read via Read-Host, most of them masked, never
  echoed, logged, or written to disk).

  Never touches production Supabase, never touches the existing local dev
  stack (different container name, different network, different host
  port, no shared volume). Contains no credentials, no decrypted data, and
  no real production values - every drill-specific value (run id, hashes,
  identity path) is a required parameter, supplied fresh each time.
  Windows PowerShell 5.1 compatible.
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$RunId,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-f]{64}$')]
  [string]$ExpectedPostgresSha256,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-f]{64}$')]
  [string]$ExpectedStorageSha256,

  [Parameter(Mandatory = $true)]
  [ValidateScript({ Test-Path $_ })]
  [string]$IdentityFilePath,

  [string]$RepoRoot = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent),

  [int]$HostPort = 55432
)

# Deeper real-world finding (reported by the human, reproduced and
# confirmed here in isolation): `$ErrorActionPreference = 'Stop'` does more
# than make `2>&1` dangerous (see Get-DockerLogsSafe below) - in Windows
# PowerShell 5.1, ANY stderr content from a native executable, regardless
# of where it's redirected (even `2>$null`), gets escalated into a
# terminating NativeCommandError under 'Stop'. Confirmed directly:
# `docker rm -f <nonexistent>` (which always writes a harmless "No such
# container" line to stderr) threw under 'Stop' and did NOT throw under
# 'Continue', with $LASTEXITCODE equally readable either way. This script's
# entire control flow already relies exclusively on explicit
# Assert-LastExitCode/throw checks, never on PowerShell's own implicit
# error-to-exception escalation for native commands - so 'Continue' loses
# no real safety here, and is what actually fixes the "diagnostic-log
# capture silently skipped the rest of `finally`" failure mode this was
# rewritten to prevent.
$ErrorActionPreference = 'Continue'

function Assert-LastExitCode {
  param([string]$StepName)
  if ($LASTEXITCODE -ne 0) {
    throw "Step '$StepName' failed: exited with code $LASTEXITCODE."
  }
}

# Real failure, reported by the human running this script: `NativeCommandError`
# noise from `docker logs ... 2>&1`. In Windows PowerShell 5.1, redirecting a
# native executable's stderr with `2>&1` wraps EVERY stderr line in an
# ErrorRecord object instead of plain text - and Postgres logs almost
# everything via stderr by default, while `docker logs` relays each of the
# container's two streams to ITS OWN matching stream, so nearly all of what
# this script needs to read arrives on docker's stderr, not stdout. That
# combination is why the noise was so pervasive. Worse: with
# `$ErrorActionPreference = 'Stop'` active, the FIRST such wrapped line gets
# escalated into a terminating exception - inside a `finally` block, an
# uncaught terminating exception can abort the REST of that `finally`, which
# is exactly how a real run left an orphaned container running and
# decrypted production data sitting in %TEMP% (confirmed and cleaned up by
# hand before writing this fix).
#
# Fix: redirect each stream to its own temp FILE (`1>file 2>file`, not
# `2>&1`) - this never goes through PowerShell's object pipeline at all, so
# it can't be wrapped as an ErrorRecord, while still capturing every line
# from both streams as plain text.
function Get-DockerLogsSafe {
  param([string]$ContainerName, [int]$Tail = 0)
  $stdoutFile = [System.IO.Path]::GetTempFileName()
  $stderrFile = [System.IO.Path]::GetTempFileName()
  try {
    if ($Tail -gt 0) {
      docker logs --tail $Tail $ContainerName 1>$stdoutFile 2>$stderrFile
    } else {
      docker logs $ContainerName 1>$stdoutFile 2>$stderrFile
    }
    $lines = @()
    if (Test-Path $stdoutFile) { $lines += @(Get-Content $stdoutFile -ErrorAction SilentlyContinue) }
    if (Test-Path $stderrFile) { $lines += @(Get-Content $stderrFile -ErrorAction SilentlyContinue) }
    return $lines
  } finally {
    Remove-Item $stdoutFile, $stderrFile -ErrorAction SilentlyContinue
  }
}

# === Step 0: pre-checks, all BEFORE asking for any credentials ===

if ([string]::IsNullOrWhiteSpace($env:TEMP)) {
  throw '$env:TEMP is not set - refusing to guess a temp directory location.'
}

if (-not (Get-Command age -ErrorAction SilentlyContinue)) {
  throw "'age' is not on PATH - install it before running this drill."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "'docker' is not on PATH."
}

# Independent review (LOW, fixed): Step 1 (right after the masked R2
# credential prompts below) shells out to `node`. Without this check here,
# a host missing Node.js would only fail AFTER the operator already typed
# their real R2 access key id/secret access key into those prompts -
# forcing a re-run and re-entry of real credentials. Checking before any
# credential is asked for avoids that.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "'node' is not on PATH - install it before running this drill (Step 1 shells out to it)."
}
docker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Docker daemon is not reachable (is Docker Desktop running?). Nothing was started."
}

$ValidateScriptPath = Join-Path $RepoRoot 'scripts\backup\validate-real-recovery.mjs'
if (-not (Test-Path $ValidateScriptPath)) {
  throw "validate-real-recovery.mjs not found at '$ValidateScriptPath' - `$RepoRoot ('$RepoRoot') is wrong. Pass -RepoRoot explicitly if this copy of the script lives outside the repo."
}
$MigrationsDir = Join-Path $RepoRoot 'supabase\migrations'
if (-not (Test-Path $MigrationsDir)) {
  throw "supabase/migrations not found at '$MigrationsDir' - `$RepoRoot is wrong."
}
$IntegrityScriptPath = Join-Path $RepoRoot 'scripts\backup\verify-referential-integrity.sql'
if (-not (Test-Path $IntegrityScriptPath)) {
  throw "verify-referential-integrity.sql not found at '$IntegrityScriptPath' - `$RepoRoot is wrong."
}

Write-Host "=== Existing containers BEFORE this drill (baseline - compare against the end-of-run listing) ==="
docker ps -a --format '{{.Names}} | {{.Ports}} | {{.Status}}'
Write-Host ""

# --- secure, masked entry for R2 credentials (never echoed, never logged, never written to disk) ---
Write-Host "R2 endpoint (e.g. https://<account-id>.r2.cloudflarestorage.com):"
$env:R2_ENDPOINT = Read-Host
Write-Host "R2 bucket name:"
$env:R2_BUCKET = Read-Host

$secureAccessKeyId = Read-Host -Prompt "R2 access key id" -AsSecureString
$bstr1 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureAccessKeyId)
$env:R2_ACCESS_KEY_ID = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr1)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr1)
$secureAccessKeyId = $null

$secureSecretKey = Read-Host -Prompt "R2 secret access key" -AsSecureString
$bstr2 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecretKey)
$env:R2_SECRET_ACCESS_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr2)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr2)
$secureSecretKey = $null

$RecoveredOutputDir = Join-Path $env:TEMP "habitex-recovery-drill-$RunId-$([guid]::NewGuid().ToString('N').Substring(0,8))"
$containerName = "habitex-recovery-drill-$($RunId -replace '[^a-zA-Z0-9]', '-')"
$pgImage = 'public.ecr.aws/supabase/postgres:17.6.1.166'

$phase2Succeeded = $false
# Set to $true right before Step 5 starts loading real production rows -
# see the `finally` block's diagnostic-log branch below for why this
# matters (found by explicit adversarial testing, not assumed).
$realDataRestoreStarted = $false
try {
  # === Step 1: re-derive plaintext dump + unpacked Storage objects ===
  Write-Host "`n=== Step 1: select -> cross-check hashes -> decrypt -> verify Storage objects ==="
  $capturedOutput = node $ValidateScriptPath $RunId $IdentityFilePath $RecoveredOutputDir $ExpectedPostgresSha256 $ExpectedStorageSha256
  $nodeExitCode = $LASTEXITCODE
  $capturedOutput | ForEach-Object { Write-Host $_ }
  $printedRealSummary = ($capturedOutput -join "`n") -match 'postgresCrossCheck'
  if ($nodeExitCode -ne 0 -or -not $printedRealSummary) {
    throw "Step 1 did not complete successfully (exit $nodeExitCode) - stopping before touching Docker. If no JSON summary printed above, this is a config/environment problem, not a backup integrity failure."
  }

  # === Step 2: bucket breakdown (counts only) ===
  Write-Host "`n=== Step 2: Storage bucket breakdown (counts only - never paths/content) ==="
  $json = ($capturedOutput -join "`n") | ConvertFrom-Json
  $byBucket = @{}
  foreach ($entry in @($json.storageVerification)) {
    if (-not $byBucket.ContainsKey($entry.bucket)) { $byBucket[$entry.bucket] = @() }
    $byBucket[$entry.bucket] += $entry
  }
  foreach ($bucket in $byBucket.Keys | Sort-Object) {
    $objects = $byBucket[$bucket]
    $matchCount = @($objects | Where-Object { $_.result -eq 'MATCH' }).Count
    Write-Host "$bucket bucket: $($objects.Count) object(s) in this snapshot, $matchCount verified MATCH"
  }

  # === Step 3: disposable Postgres container - never touches production, never the existing dev stack ===
  Write-Host "`n=== Step 3: starting disposable container (no production credential ever used here) ==="
  $throwawayPassword = [guid]::NewGuid().ToString('N')
  docker run -d --name $containerName --rm -p "${HostPort}:5432" -e "POSTGRES_PASSWORD=$throwawayPassword" $pgImage | Out-Null
  Assert-LastExitCode "docker run"

  # Real failure, found and reported by the human running this script:
  # `psql: FATAL: the database system is shutting down` right at Step 3.5.
  # Root cause, confirmed against the real postgres docker-entrypoint.sh
  # source (docker-library/postgres): on a FRESH container (no existing
  # data directory - always true here, nothing persists between runs),
  # the entrypoint starts a TEMPORARY, init-only server first
  # (`pg_ctl ... -o "-c listen_addresses='' ..." start`), runs
  # docker-entrypoint-initdb.d scripts against it, STOPS it
  # (`pg_ctl ... -m fast -w stop`), and only THEN execs the real,
  # definitive server. A naive `docker exec ... pg_isready` (no `-h`)
  # connects via the container's own Unix socket - which the TEMPORARY
  # server also accepts, since `listen_addresses=''` only disables TCP, not
  # the socket - so it can declare "ready" against the temporary server,
  # racing its shutdown a moment later.
  #
  # Fix: `listen_addresses=''` means the temporary server NEVER listens on
  # the host-published TCP port either - so waiting for the log line
  # "database system is ready to accept connections" to appear a SECOND
  # time (first = temporary server, second = the real one, confirmed by
  # the entrypoint's own two-phase sequence above) is a deterministic
  # signal, not a race. Followed by a stable round-trip confirmation below.
  Write-Host "Waiting for Postgres's definitive (post-init) server to be ready..."
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    $readyLineCount = (Get-DockerLogsSafe -ContainerName $containerName | Select-String -Pattern 'database system is ready to accept connections' -SimpleMatch).Count
    if ($readyLineCount -ge 2) { $ready = $true; break }
  }
  if (-not $ready) {
    throw "Postgres in container '$containerName' never reached its definitive (post-init) ready state after 120s (saw the 'ready to accept connections' log line fewer than 2 times - expected one for the temporary init server and one for the real one)."
  }

  # "Real and STABLE" connection check, not just one lucky round-trip: 3
  # consecutive successful queries, 1s apart. Any single failure resets the
  # counter - all 3 must succeed in a row.
  $stableConfirmations = 0
  for ($j = 0; $j -lt 3; $j++) {
    docker exec $containerName psql -U postgres -c "select 1;" postgres | Out-Null
    if ($LASTEXITCODE -eq 0) { $stableConfirmations++ } else { $stableConfirmations = 0 }
    if ($j -lt 2) { Start-Sleep -Seconds 1 }
  }
  if ($stableConfirmations -lt 3) {
    throw "Definitive server did not respond stably - only $stableConfirmations of 3 consecutive confirming queries succeeded."
  }
  Write-Host "Confirmed: definitive server is up and stable (3/3 consecutive real queries succeeded)."

  # Independent review (MEDIUM): the Supabase-flavored base image's
  # self-initialization of auth/storage/extensions schemas and base roles
  # has only ever been validated via `supabase start`/`db reset` (the CLI),
  # never via a bare `docker run` like this script does. Habitex's own
  # migrations never create these (confirmed: no CREATE ROLE for
  # anon/authenticated/service_role, no CREATE SCHEMA auth/storage/
  # extensions anywhere in supabase/migrations/ - only GRANTs to them and
  # backup_reader's own CREATE ROLE). Check explicitly, BEFORE replaying
  # migrations against real production data, rather than letting a missing
  # schema/role surface only as an opaque migration-replay failure deeper in.
  Write-Host "`n--- Step 3.5: confirm the base image self-initialized the expected schemas/roles ---"
  $expectedSchemas = 'auth', 'storage', 'extensions'
  $expectedRoles = 'anon', 'authenticated', 'service_role'
  $schemaCheck = docker exec $containerName psql -U postgres -t -A -c "select string_agg(nspname, ',') from pg_namespace where nspname = any(array['auth','storage','extensions']);" postgres
  Assert-LastExitCode "check base schemas"
  $roleCheck = docker exec $containerName psql -U postgres -t -A -c "select string_agg(rolname, ',') from pg_roles where rolname = any(array['anon','authenticated','service_role']);" postgres
  Assert-LastExitCode "check base roles"
  $foundSchemas = @(($schemaCheck -join '') -split ',' | Where-Object { $_ })
  $foundRoles = @(($roleCheck -join '') -split ',' | Where-Object { $_ })
  $missingSchemas = @($expectedSchemas | Where-Object { $_ -notin $foundSchemas })
  $missingRoles = @($expectedRoles | Where-Object { $_ -notin $foundRoles })
  if ($missingSchemas.Count -gt 0 -or $missingRoles.Count -gt 0) {
    throw "Base image did not self-initialize as expected - missing schema(s): $($missingSchemas -join ', '); missing role(s): $($missingRoles -join ', '). Stopping BEFORE replaying migrations against real production data."
  }
  Write-Host "Confirmed present: schemas [$($foundSchemas -join ', ')], roles [$($foundRoles -join ', ')]"

  # Real failure, found and reproduced in isolation: migration replay failed
  # on `supabase/migrations/20260827100005_private_storage_rls.sql` with
  # `ERROR: relation "storage.buckets" does not exist`. Root cause,
  # confirmed by direct comparison against the real local dev stack: the
  # bare postgres image's own docker-entrypoint-initdb.d scripts create the
  # `storage` SCHEMA (namespace) but none of its TABLES - those are created
  # by the storage-api SERVICE itself, which self-migrates on first
  # connect (confirmed via its own real logs: "[Migrations] Running
  # vector_store migrations").
  #
  # This step runs a THROWAWAY storage-api (the exact version the existing
  # local dev stack already uses, for fidelity) on its OWN dedicated,
  # isolated Docker network - never the existing dev stack's network -
  # connected to the disposable Postgres container by name, with
  # freshly-generated, single-use credentials (never anything from the
  # real dev stack or production), publishing NO port (its HTTP API is
  # never used - only its internal migration side-effect matters). Once
  # confirmed to have created the expected objects, it is stopped and
  # removed immediately - it never stays up for the rest of the drill.
  Write-Host "`n--- Step 3.75: bootstrap Supabase Storage's internal schema (storage.buckets/objects/foldername) ---"
  $drillNetworkName = "habitex-drill-net-$($RunId -replace '[^a-zA-Z0-9]', '-')"
  $storageHelperName = "habitex-storage-bootstrap-$($RunId -replace '[^a-zA-Z0-9]', '-')"
  $storageAdminPassword = [guid]::NewGuid().ToString('N')
  $storageHelperJwtSecret = "drill-only-$([guid]::NewGuid().ToString('N'))"

  # Defensive pre-cleanup: if an earlier interrupted run left these names
  # behind (despite the `finally` below normally handling it), a fresh
  # `docker network create`/`docker run --name` would otherwise fail with
  # a "name already in use" error that has nothing to do with today's run.
  docker network rm $drillNetworkName 2>$null | Out-Null
  docker rm -f $storageHelperName 2>$null | Out-Null

  docker network create $drillNetworkName | Out-Null
  Assert-LastExitCode "create isolated drill network"
  docker network connect $drillNetworkName $containerName
  Assert-LastExitCode "connect disposable Postgres to the isolated drill network"

  # `supabase_storage_admin` is a `supautils`-reserved role (the same
  # protection the real remote project has) - only the true superuser
  # (`supabase_admin`) can alter it, not `postgres` (which, like
  # production, is not itself a superuser on this image).
  docker exec $containerName psql -U supabase_admin -c "alter role supabase_storage_admin with password '$storageAdminPassword';" postgres | Out-Null
  Assert-LastExitCode "set throwaway supabase_storage_admin password"

  $storageDbUrl = "postgresql://supabase_storage_admin:${storageAdminPassword}@${containerName}:5432/postgres"
  docker run -d --name $storageHelperName --network $drillNetworkName -e "DATABASE_URL=$storageDbUrl" -e "TENANT_ID=stub" -e "STORAGE_BACKEND=file" -e "FILE_STORAGE_BACKEND_PATH=/mnt" -e "GLOBAL_S3_BUCKET=stub" -e "AUTH_JWT_SECRET=$storageHelperJwtSecret" -e "ANON_KEY=drill-placeholder-anon" -e "SERVICE_KEY=drill-placeholder-service" -e "VECTOR_STORE_MIGRATIONS_ENABLED=false" public.ecr.aws/supabase/storage-api:v1.77.5 | Out-Null
  Assert-LastExitCode "start storage-api bootstrap helper"

  Write-Host "Waiting for the storage-api helper to self-migrate..."
  $storageReady = $false
  for ($k = 0; $k -lt 30; $k++) {
    Start-Sleep -Seconds 2
    $probe = docker exec $containerName psql -U postgres -t -A -c "select count(*) from pg_tables where schemaname='storage' and tablename='buckets';" postgres
    if (($probe -join '').Trim() -eq '1') { $storageReady = $true; break }
  }
  if (-not $storageReady) {
    throw "storage-api helper did not create storage.buckets within 60s - see diagnostic logs below (if this run fails) for the helper's own startup errors."
  }

  # Explicit, named-object checks (don't settle for a bare table COUNT) - a
  # table and a function are different catalogs (pg_tables / pg_proc),
  # checked separately.
  $expectedStorageTables = 'buckets', 'objects'
  $storageTableCheck = docker exec $containerName psql -U postgres -t -A -c "select string_agg(tablename, ',') from pg_tables where schemaname='storage' and tablename = any(array['buckets','objects']);" postgres
  Assert-LastExitCode "check storage.buckets/storage.objects"
  $storageFunctionCheck = docker exec $containerName psql -U postgres -t -A -c "select string_agg(proname, ',') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='storage' and proname='foldername';" postgres
  Assert-LastExitCode "check storage.foldername()"
  $foundStorageTables = @(($storageTableCheck -join '') -split ',' | Where-Object { $_ })
  $foundStorageFunctions = @(($storageFunctionCheck -join '') -split ',' | Where-Object { $_ })
  $missingStorageTables = @($expectedStorageTables | Where-Object { $_ -notin $foundStorageTables })
  if ($missingStorageTables.Count -gt 0 -or $foundStorageFunctions.Count -eq 0) {
    throw "Storage bootstrap did not create the expected objects - missing table(s): $($missingStorageTables -join ', '); storage.foldername() found: $($foundStorageFunctions.Count -gt 0). Stopping BEFORE replaying migrations against real production data."
  }
  Write-Host "Confirmed present: storage.buckets, storage.objects, storage.foldername()."
  Write-Host "NOTE: this confirms the specific named objects Habitex's own migrations reference exist - it is NOT a full structural comparison (column types, constraints, indexes, RLS policies, etc.) against the real storage-api schema. See docs/ops/real-recovery-drill-plan.md for this caveat in writing."

  # Storage helper's job is done - stop and remove it now (the isolated
  # network stays up a bit longer, shared with the auth bootstrap below).
  docker stop $storageHelperName | Out-Null
  docker rm -f $storageHelperName 2>$null | Out-Null
  Write-Host "Storage-api bootstrap helper removed."

  # Real failure, found and reproduced in isolation: the real dump restore
  # failed with `ERROR: column "email_confirmed_at" of relation "users"
  # does not exist`. Root cause: "auth needs no bootstrap" was INCOMPLETE -
  # it was based only on what Habitex's own *migrations* reference as
  # schema objects (auth.users/auth.uid(), both present in the bare
  # image's older GoTrue schema), not on what the real data DUMP actually
  # contains. A data-only pg_dump of auth.users includes every column that
  # table has in the REAL remote project at export time - the full modern
  # GoTrue schema (33 columns, confirmed by direct comparison against the
  # real local dev stack), not the ~20-column legacy schema baked into the
  # bare postgres image's own docker-entrypoint-initdb.d scripts. Same
  # underlying mechanism as storage.buckets (§3.75): GoTrue self-migrates
  # its own schema on first connect (confirmed via its own real logs:
  # "GoTrue migrations applied successfully"), never the base image alone.
  #
  # Fix: identical pattern to §3.75 - a THROWAWAY gotrue helper (the exact
  # version the existing local dev stack already uses) on the SAME
  # isolated network (never the existing dev stack's network, no published
  # port), with freshly-generated, single-use credentials. Once confirmed
  # to have created the expected objects, stopped and removed - it never
  # stays up for the rest of the drill, and never serves its HTTP API to
  # anything.
  Write-Host "`n--- Step 3.8: bootstrap Supabase Auth's internal schema (auth.users' full column set + dependent tables) ---"
  $authHelperName = "habitex-auth-bootstrap-$($RunId -replace '[^a-zA-Z0-9]', '-')"
  $authAdminPassword = [guid]::NewGuid().ToString('N')
  $authHelperJwtSecret = "drill-only-$([guid]::NewGuid().ToString('N'))"

  docker rm -f $authHelperName 2>$null | Out-Null

  # `supabase_auth_admin` is a `supautils`-reserved role too (same
  # protection as `supabase_storage_admin` above) - only `supabase_admin`
  # can alter it.
  docker exec $containerName psql -U supabase_admin -c "alter role supabase_auth_admin with password '$authAdminPassword';" postgres | Out-Null
  Assert-LastExitCode "set throwaway supabase_auth_admin password"

  $authDbUrl = "postgres://supabase_auth_admin:${authAdminPassword}@${containerName}:5432/postgres"
  docker run -d --name $authHelperName --network $drillNetworkName -e "GOTRUE_DB_DRIVER=postgres" -e "GOTRUE_DB_DATABASE_URL=$authDbUrl" -e "API_EXTERNAL_URL=http://localhost:9999" -e "GOTRUE_API_HOST=0.0.0.0" -e "GOTRUE_API_PORT=9999" -e "GOTRUE_JWT_SECRET=$authHelperJwtSecret" -e "GOTRUE_SITE_URL=http://localhost:3000" public.ecr.aws/supabase/gotrue:v2.197.0 | Out-Null
  Assert-LastExitCode "start gotrue bootstrap helper"

  # Independent review (MEDIUM, fixed): polling for a single early-schema
  # marker (auth.users.email_confirmed_at) and then immediately asserting
  # the FULL expected-object set in one shot (no further polling) races
  # GoTrue's own sequential migrations - some of the tables checked below
  # (mfa_factors, one_time_tokens, flow_state) are created by LATER
  # migrations than that column. Fixed by polling for the FULL expected
  # object set directly, every iteration, instead of a single early proxy
  # column.
  Write-Host "Waiting for the gotrue helper to self-migrate (polling for the full expected object set, not just one early column)..."
  $expectedAuthTables = 'users', 'identities', 'sessions', 'refresh_tokens', 'mfa_factors', 'one_time_tokens', 'audit_log_entries', 'flow_state'
  $expectedAuthColumns = 'email_confirmed_at', 'phone_confirmed_at', 'banned_until', 'is_sso_user', 'deleted_at', 'is_anonymous'
  $authReady = $false
  $foundAuthTables = @()
  $foundAuthColumns = @()
  for ($m = 0; $m -lt 30; $m++) {
    Start-Sleep -Seconds 2
    $authTableCheck = docker exec $containerName psql -U postgres -t -A -c "select string_agg(tablename, ',') from pg_tables where schemaname='auth' and tablename = any(array['users','identities','sessions','refresh_tokens','mfa_factors','one_time_tokens','audit_log_entries','flow_state']);" postgres
    $authColumnCheck = docker exec $containerName psql -U postgres -t -A -c "select string_agg(column_name, ',') from information_schema.columns where table_schema='auth' and table_name='users' and column_name = any(array['email_confirmed_at','phone_confirmed_at','banned_until','is_sso_user','deleted_at','is_anonymous']);" postgres
    $foundAuthTables = @(($authTableCheck -join '') -split ',' | Where-Object { $_ })
    $foundAuthColumns = @(($authColumnCheck -join '') -split ',' | Where-Object { $_ })
    $missingAuthTables = @($expectedAuthTables | Where-Object { $_ -notin $foundAuthTables })
    $missingAuthColumns = @($expectedAuthColumns | Where-Object { $_ -notin $foundAuthColumns })
    if ($missingAuthTables.Count -eq 0 -and $missingAuthColumns.Count -eq 0) { $authReady = $true; break }
  }
  if (-not $authReady) {
    throw "Auth bootstrap did not create the expected objects within 60s - missing table(s): $($missingAuthTables -join ', '); missing auth.users column(s): $($missingAuthColumns -join ', '). Stopping BEFORE restoring real production data - see diagnostic logs below (if this run fails) for the helper's own startup errors."
  }
  $authTableCountCheck = docker exec $containerName psql -U postgres -t -A -c "select count(*) from pg_tables where schemaname='auth';" postgres
  Assert-LastExitCode "check total auth table count"
  Write-Host "Confirmed present: auth tables [$($foundAuthTables -join ', ')] (of $(($authTableCountCheck -join '').Trim()) total in auth), auth.users columns [$($foundAuthColumns -join ', ')]."
  Write-Host "NOTE: this confirms the specific named objects checked exist - it is NOT a full structural comparison (every column/constraint/index/RLS policy on all auth tables) against the real gotrue schema. Same caveat as §3.75's storage bootstrap - see docs/ops/real-recovery-drill-plan.md."

  docker stop $authHelperName | Out-Null
  docker rm -f $authHelperName 2>$null | Out-Null
  Write-Host "Gotrue bootstrap helper removed."

  docker network disconnect $drillNetworkName $containerName 2>$null | Out-Null
  docker network rm $drillNetworkName 2>$null | Out-Null
  Write-Host "Isolated drill network removed - only the disposable Postgres container remains."

  # Real risk, checked and confirmed empirically (not assumed): this
  # image's default `log_min_error_statement = 'error'` makes Postgres log
  # the FULL TEXT of any failing statement to its own container logs.
  # Reproduced directly: a deliberately failing INSERT containing a marker
  # string DID appear verbatim in `docker logs` output. From here on, Step
  # 5 restores REAL PRODUCTION DATA - if a later statement in that restore
  # (or anything after it) ever fails, its full text could contain real
  # row values, and this script's own diagnostic-log capture
  # (Get-DockerLogsSafe, in `finally`, triggered on ANY failure) would
  # otherwise print that text verbatim. Raising the threshold here -
  # confirmed empirically to still leave the ERROR ITSELF fully visible,
  # only suppressing the echoed statement text - closes this before any
  # real data starts flowing.
  docker exec $containerName psql -U supabase_admin -c "alter system set log_min_error_statement = 'panic';" postgres | Out-Null
  Assert-LastExitCode "raise log_min_error_statement before real production data starts flowing"
  # Independent review (BLOCKER, fixed): `log_min_error_statement` above
  # only suppresses the `STATEMENT:` line Postgres appends to its own
  # server log - it does NOT touch `DETAIL`/`HINT`/`CONTEXT`, which are
  # governed by the separate `log_error_verbosity` setting (default
  # 'default', which still logs them server-side; only 'terse' suppresses
  # them). Since Postgres logs to stderr (captured by `docker logs`), a
  # real NOT NULL or duplicate-key violation during Step 5 - the exact two
  # classes already confirmed above to leak a full row/key via `DETAIL` -
  # would still land in the container's own log independent of what psql
  # prints, and `Get-DockerLogsSafe` (in `finally`, triggered on ANY
  # failure) would print that log verbatim to the console, reintroducing
  # the same leak VERBOSITY=sqlstate was built to eliminate, via a channel
  # that setting never touches. Both settings are required together - one
  # for psql's client-side output, one for the server's own log.
  #
  # Residual gap, found by further explicit testing (fake marker values,
  # not assumed): for error classes where Postgres embeds the offending
  # value directly in the PRIMARY message text (e.g. `invalid input syntax
  # for type uuid: "<value>"`), 'terse' does not touch that message text -
  # confirmed concretely. See the `finally` block below's
  # `$realDataRestoreStarted` branch for how this residual gap is actually
  # closed (withholding container logs entirely past that point, not a log
  # setting).
  docker exec $containerName psql -U supabase_admin -c "alter system set log_error_verbosity = 'terse';" postgres | Out-Null
  Assert-LastExitCode "raise log_error_verbosity before real production data starts flowing"
  docker exec $containerName psql -U supabase_admin -c "select pg_reload_conf();" postgres | Out-Null
  Assert-LastExitCode "reload Postgres config"

  Write-Host "`n--- Step 4: replaying migrations (schema only) ---"
  docker cp "$MigrationsDir\." "${containerName}:/tmp/migrations/"
  Assert-LastExitCode "docker cp migrations"

  # Real failure, found and reproduced in isolation: `docker exec $containerName
  # bash -c '...script with embedded double quotes...'` corrupted the script
  # text before bash ever saw it. Root cause: PowerShell reconstructs a
  # single argument containing embedded double-quote characters for a
  # NATIVE executable's Windows command line unreliably - the embedded `"`
  # characters get misinterpreted as argument boundaries, truncating/
  # corrupting the string docker.exe actually receives. Fix: write the
  # replay script to a local file (no PowerShell string-argument involved
  # at all beyond a single file path, which has no embedded quotes to
  # corrupt), copy it in, and run it by path.
  $replayScriptContent = @'
#!/bin/bash
set -e
for f in /tmp/migrations/*.sql; do
  echo "-- applying: $f"
  psql -U postgres -v ON_ERROR_STOP=1 -f "$f" postgres
done
'@ -replace "`r`n", "`n"
  $replayScriptLocalPath = Join-Path $env:TEMP "habitex-drill-replay-migrations-$([guid]::NewGuid().ToString('N').Substring(0,8)).sh"
  try {
    [System.IO.File]::WriteAllText($replayScriptLocalPath, $replayScriptContent, (New-Object System.Text.UTF8Encoding $false))
    docker cp $replayScriptLocalPath "${containerName}:/tmp/replay-migrations.sh"
    Assert-LastExitCode "docker cp replay-migrations.sh"
    docker exec $containerName bash /tmp/replay-migrations.sh
    Assert-LastExitCode "replay migrations"
  } finally {
    Remove-Item $replayScriptLocalPath -ErrorAction SilentlyContinue
  }

  Write-Host "`n--- Step 5: restoring the recovered data-only dump (real restoration, not a dry run) ---"
  docker cp "$RecoveredOutputDir\$RunId.postgres.sql" "${containerName}:/tmp/recovered.postgres.sql"
  Assert-LastExitCode "docker cp recovered dump"

  # Real risk, found and confirmed by explicit, adversarial testing against
  # multiple real Postgres error classes (not assumed safe): a FAILING
  # statement during this restore can echo real row values DIRECTLY to
  # psql's own client-side output - which streams straight to this
  # console, bypassing `log_min_error_statement`/`log_error_verbosity`
  # entirely (those settings only affect what the SERVER logs internally,
  # never what `psql` itself prints when a `-f` script hits an error).
  # Confirmed concretely, with throwaway marker values standing in for
  # real data: an undefined-column error echoed a truncated fragment of
  # the literal failing statement on a `LINE 1: ...` line; an invalid
  # input syntax error (e.g. a malformed UUID) printed the literal bad
  # value DIRECTLY on the top-level "ERROR:" line itself - proving "just
  # keep ERROR: lines" is NOT a safe filtering strategy; a NOT NULL
  # violation's "DETAIL: Failing row contains (...)" printed the ENTIRE
  # row's values; a duplicate-key violation's "DETAIL: Key (...)=(...)
  # already exists" printed the conflicting key's value. Also confirmed
  # clean for a COPY-mid-stream failure (the actual mechanism a data-only
  # restore uses, not a plain INSERT).
  #
  # Fix: `-v VERBOSITY=sqlstate`, a built-in psql option (not a custom
  # regex/text filter of untrusted error text) that reduces every error
  # report to its bare 5-character SQLSTATE code - confirmed that no
  # marker value survives in ANY form (no ERROR message text, no DETAIL,
  # no LINE, no STATEMENT, no CONTEXT) while the SQLSTATE itself still
  # gives a real, look-up-able diagnostic class, and `$LASTEXITCODE` still
  # propagates correctly.
  #
  # Flag set immediately before this exact command, not earlier (not
  # before the `docker cp` above): a failure in `docker cp` itself
  # (copying a file, never executing SQL, so it cannot itself echo row
  # content) still gets the full container-log diagnostic in `finally`,
  # while any failure from THIS point on - the instant real rows can start
  # hitting a failing constraint - gets the redacted diagnostic instead.
  $realDataRestoreStarted = $true
  docker exec $containerName psql -U postgres -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -f /tmp/recovered.postgres.sql postgres
  Assert-LastExitCode "restore recovered dump"

  Write-Host "`n--- Step 6: referential integrity check (every FK constraint, generic - names/counts only) ---"
  docker cp $IntegrityScriptPath "${containerName}:/tmp/verify-referential-integrity.sql"
  Assert-LastExitCode "docker cp integrity script"
  # `-v ON_ERROR_STOP=1` is required alongside verify-referential-
  # integrity.sql's own `raise exception` on a real orphan - without it,
  # psql could still exit 0 instead of propagating the failure.
  # `-v VERBOSITY=sqlstate` added for defense-in-depth and consistency with
  # Step 5, even though this script only ever emits aggregate names/counts
  # via RAISE NOTICE/RAISE EXCEPTION, never a raw row.
  docker exec $containerName psql -U postgres -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -f /tmp/verify-referential-integrity.sql postgres
  Assert-LastExitCode "verify-referential-integrity.sql"

  Write-Host "`n--- Step 7: aggregate row counts ONLY - never literal row content (real production data) ---"
  docker exec $containerName psql -U postgres -t -A -F'|' -c "
    select 'administrations' as table_name, count(*) as row_count from public.administrations
    union all select 'people', count(*) from public.people
    union all select 'rental_relationships', count(*) from public.rental_relationships
    union all select 'charges', count(*) from public.charges
    union all select 'payments', count(*) from public.payments
    union all select 'files', count(*) from public.files
    union all select 'storage.objects', count(*) from storage.objects
    union all select 'auth.users', count(*) from auth.users
    order by 1;" postgres
  Assert-LastExitCode "aggregate row counts"

  Write-Host "`n=== PHASE 2 PASSED ==="
  Write-Host "Paste back ONLY: the Step 2 bucket breakdown, the referential-integrity NOTICE line, and the Step 7 row counts."
  Write-Host "Never paste anything that looks like a real name, email, address, document content, or financial amount."
  $phase2Succeeded = $true
}
finally {
  # Real failure, found and fixed: the diagnostic-log capture below used to
  # run un-guarded, directly in `finally`. When it broke, it silently
  # skipped EVERYTHING after it in this same `finally` block - `docker
  # stop`, the env var cleanup, and the deletion of $RecoveredOutputDir
  # never ran. Confirmed by hand: a real failed run left both a live
  # container (still exposing the real restored data on its host port) and
  # the decrypted plaintext dump + Storage objects sitting in %TEMP% -
  # cleaned up manually before this fix was written. Wrapping this block in
  # its own try/catch means ANY failure here can never again prevent the
  # cleanup section below from running.
  if (-not $phase2Succeeded) {
    try {
      if (docker ps -a --filter "name=^$containerName$" --format '{{.Names}}') {
        if ($realDataRestoreStarted) {
          # Independent review's VERBOSITY=sqlstate fix covers psql's own
          # CLIENT-side output. It does NOT touch the server's own
          # internal log, which is a separate code path. Explicit testing
          # with fake sensitive markers found that for error classes where
          # Postgres embeds the bad value directly in the PRIMARY message
          # (e.g. `invalid input syntax for type uuid: "<value>"`),
          # 'terse' does not touch that message text - confirmed by
          # directly reproducing it against a throwaway container, where
          # it appeared verbatim in `docker logs` even with both
          # log_min_error_statement='panic' and log_error_verbosity=
          # 'terse' applied. Per explicit requirement ("usa un diagnostico
          # redactado o generico cuando no puedas garantizar la seguridad
          # del mensaje"), container logs are withheld entirely once real
          # data could be involved - a generic diagnostic is given
          # instead.
          Write-Host "`n--- Diagnostic logs withheld (failure occurred during or after Step 5, once real production data was being loaded) ---"
          Write-Host "Verbatim container logs are not safe to print past this point - some Postgres error classes embed the offending value directly in their primary error message, which no log-verbosity setting suppresses (confirmed by explicit testing, not assumed)."
          Write-Host "Use psql's own SQLSTATE output above (step 5/6/7, VERBOSITY=sqlstate) to identify the error CLASS - e.g. 23502=not-null violation, 22P02=invalid input syntax, 23505=duplicate key, 42703=undefined column - and the dump line number psql already printed (e.g. 'psql:/tmp/recovered.postgres.sql:NN:')."
          Write-Host "If deeper diagnosis is genuinely required, reproduce structurally in a fresh disposable container using Steps 0-4 only (schema replay, no real data) - never by printing this container's logs after real data started loading."
        } else {
          Write-Host "`n--- Diagnostic logs (container failed before any real production data was loaded - last 200 lines, password redacted) ---"
          Write-Host "(log_min_error_statement/log_error_verbosity were raised before real data could flow so a later SQL error's full statement text/detail - which could contain real production row values - is never echoed here; the error itself still is, and no real data has been restored yet at this point.)"
          $logs = Get-DockerLogsSafe -ContainerName $containerName -Tail 200
          foreach ($secret in @($throwawayPassword, $storageAdminPassword, $storageHelperJwtSecret, $authAdminPassword, $authHelperJwtSecret)) {
            if ($secret) { $logs = $logs -replace [regex]::Escape($secret), '[REDACTED]' }
          }
          $logs | ForEach-Object { Write-Host $_ }
        }
      }
    } catch {
      Write-Host "Could not capture diagnostic logs (non-fatal - proceeding to cleanup regardless): $($_.Exception.Message)"
    }
  }

  Write-Host "`n--- Cleanup ---"
  docker stop $containerName 2>$null | Out-Null

  # Safety-net cleanup for Step 3.75/3.8's resources - those steps already
  # stop and remove these themselves on their own success path, so these
  # are normally no-ops by the time execution reaches here. They exist for
  # the case one of those steps failed partway through and never got to
  # its own cleanup. Errors here are printed, never silenced - cleanup
  # errors must stay visible.
  if ($storageHelperName) {
    $helperStillExists = docker ps -a --filter "name=^$storageHelperName$" --format '{{.Names}}'
    if ($helperStillExists) {
      docker rm -f $storageHelperName
      if ($LASTEXITCODE -ne 0) {
        Write-Host "*** FAILED to remove leftover storage-api helper container '$storageHelperName' (exit $LASTEXITCODE) - remove it by hand: docker rm -f $storageHelperName ***"
      }
    }
  }
  if ($authHelperName) {
    $authHelperStillExists = docker ps -a --filter "name=^$authHelperName$" --format '{{.Names}}'
    if ($authHelperStillExists) {
      docker rm -f $authHelperName
      if ($LASTEXITCODE -ne 0) {
        Write-Host "*** FAILED to remove leftover gotrue helper container '$authHelperName' (exit $LASTEXITCODE) - remove it by hand: docker rm -f $authHelperName ***"
      }
    }
  }
  if ($drillNetworkName) {
    $networkStillExists = docker network ls --filter "name=^$drillNetworkName$" --format '{{.Name}}'
    if ($networkStillExists) {
      docker network rm $drillNetworkName
      if ($LASTEXITCODE -ne 0) {
        Write-Host "*** FAILED to remove leftover isolated drill network '$drillNetworkName' (exit $LASTEXITCODE) - remove it by hand: docker network rm $drillNetworkName ***"
      }
    }
  }

  Remove-Item Env:\R2_ENDPOINT, Env:\R2_BUCKET, Env:\R2_ACCESS_KEY_ID, Env:\R2_SECRET_ACCESS_KEY -ErrorAction SilentlyContinue
  if (Test-Path $RecoveredOutputDir) {
    # Under the global `$ErrorActionPreference = 'Continue'`, a bare
    # `Remove-Item` with no `-ErrorAction` turns a real deletion failure (a
    # locked file, antivirus scan, read-only attribute, etc.) into a
    # silent, NON-terminating error - execution continues straight to the
    # "deleted" success message below regardless, falsely telling the
    # operator that real, decrypted production data no longer exists on
    # disk when it still does. This is the single most sensitive cleanup
    # step in the whole script (it's the one holding the decrypted
    # Postgres dump and unpacked Storage objects), so it gets its own
    # explicit `-ErrorAction Stop` + try/catch - never silenced, and the
    # catch names the exact path so the operator can delete it by hand
    # immediately if this ever fails.
    try {
      Remove-Item -Recurse -Force $RecoveredOutputDir -ErrorAction Stop
      Write-Host "Decrypted output directory deleted - nothing persisted on disk by this script."
    } catch {
      Write-Host "`n*** FAILED TO DELETE DECRYPTED OUTPUT DIRECTORY - REAL PRODUCTION DATA MAY STILL BE ON DISK ***"
      Write-Host "Path: $RecoveredOutputDir"
      Write-Host "Error: $($_.Exception.Message)"
      Write-Host "Delete this directory by hand right now before considering cleanup complete."
    }
  }
  Write-Host "R2 credentials cleared from this shell session. Disposable container stopped (and removed, --rm)."
  Write-Host "`n=== Existing containers AFTER this drill (compare against the step-0 baseline above) ==="
  docker ps -a --format '{{.Names}} | {{.Ports}} | {{.Status}}'
}
