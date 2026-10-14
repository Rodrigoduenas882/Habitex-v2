#!/usr/bin/env bash
# Exports Habitex's public/auth/storage data using the minimal-privilege
# backup_reader role (INC-BKP-001), replacing `supabase db dump`, which
# hardcodes --role "postgres" into its generated pg_dump invocation and is
# therefore structurally incompatible with any restricted role (confirmed
# via `supabase db dump --dry-run`, both modes, pinned CLI 2.117.0,
# INC-BKP-001 and re-confirmed INC-BKP-002).
#
# Deliberate differences from the Supabase CLI's own data-only dump script
# (see docs/ops/postgres-export-validation-findings.md for the full
# comparison and why each one was decided - this is not a blind copy):
#   - no --role flag: backup_reader already has BYPASSRLS + pg_read_all_data,
#     so no SET ROLE is needed, and none would be grantable anyway.
#   - --exclude-table "storage.buckets" added (the CLI's own data-only mode
#     does not exclude it): bucket rows are migration-provisioned config
#     (see supabase/migrations/20260827100005_private_storage_rls.sql,
#     applied with ON CONFLICT ... DO UPDATE), not tenant data - including
#     them in a data-only restore collides with that migration-time upsert
#     on any schema freshly rebuilt from supabase/migrations/. Found by
#     actually running a restore locally, not by inspection.
#   - no --disable-triggers: it emits ALTER TABLE ... DISABLE/ENABLE TRIGGER
#     ALL, which requires table ownership this role deliberately does not
#     have (dumps run with --no-owner/--no-privileges). The
#     SET session_replication_role = replica wrapper below achieves the same
#     restore-ordering effect at the session level without needing it.
#
# What this script does NOT produce, by design:
#   - Schema. Restore always sources schema from supabase/migrations/ via
#     the normal migration process, never from a schema dump - this script
#     only ever produces data-only output.
#   - A roles.sql-equivalent. Dumping role definitions requires reading
#     pg_authid, restricted to superuser/postgres-equivalent regardless of
#     pg_read_all_data; assessed as low-value for a Supabase-to-Supabase
#     restore (standard roles are platform-provisioned on any project).
#
# Required environment variables (never hardcode credentials here, and
# never commit a file that sets PGPASSWORD to a real value):
#   PGHOST, PGPORT, PGDATABASE, PGUSER (backup_reader), PGPASSWORD
#
# Usage: ./scripts/backup/export-postgres-data.sh > backup.sql

set -euo pipefail

: "${PGHOST:?PGHOST is required}"
: "${PGPORT:?PGPORT is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"

echo "SET session_replication_role = replica;"

pg_dump \
  --no-owner --no-privileges \
  --data-only \
  --quote-all-identifier \
  --exclude-schema "information_schema|pg_*|graphql|graphql_public|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault|etl|extensions|pgbouncer|realtime|supabase_migrations|_analytics|_realtime|_supavisor" \
  --exclude-table "auth.schema_migrations" \
  --exclude-table "storage.migrations" \
  --exclude-table "supabase_functions.migrations" \
  --exclude-table "storage.buckets" \
  --schema "*" \
  --column-inserts --rows-per-insert 100000 \
  | sed -E 's/^\\(un)?restrict .*$/-- &/'

echo "RESET ALL;"
