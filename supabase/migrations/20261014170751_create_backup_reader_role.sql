-- Creates a dedicated, minimal-for-its-purpose Postgres role for the
-- external backup pipeline designed under the Backup & Disaster Recovery
-- architecture (INC-BKP-001 Phase 1) - one piece contributing toward
-- eventually closing audit finding D1 (no backup mechanism, Supabase Free
-- tier has none), not a resolution of D1 by itself. Authored as part of the
-- human-approved first implementation increment; applying this migration
-- against the real remote project is a SEPARATE, explicit human approval,
-- never implicit from authoring it (CLAUDE.md §5 / ARCHITECTURE.md §0.1).
-- This migration was verified locally only (supabase start / db reset) -
-- it has not been applied to any remote project as of authoring.
--
-- Why BYPASSRLS is required, not optional (verified, not assumed):
--   pg_dump runs with the dumping role's own RLS in effect unless that role
--   has BYPASSRLS. Every RLS policy in this schema gates on administration
--   membership (can_manage_administration/can_view_relationship/
--   is_administration_member) - a role with no membership row anywhere
--   would see ZERO rows on every RLS-protected table without BYPASSRLS,
--   producing a silently empty "backup" rather than a smaller-but-correct
--   one. BYPASSRLS is therefore load-bearing for backup completeness, not
--   a convenience.
--
-- Why pg_read_all_data (a real, predefined Postgres role since v14) instead
-- of per-table GRANTs: it grants SELECT on every table/view/sequence in
-- every schema (public, auth, storage) in one statement, including any
-- table added by a future migration - per-table grants would silently stop
-- covering new tables the moment this migration's own snapshot goes stale.
--
-- What this role deliberately CANNOT do - the actual minimal-privilege
-- property, scoped to the dimension that matters for a backup credential:
--   - No CREATEDB, no CREATEROLE, no superuser.
--   - No INSERT/UPDATE/DELETE/TRUNCATE/DDL grant of any kind, anywhere -
--     BYPASSRLS bypasses the RLS *filter*, never the privilege system
--     itself; a role with BYPASSRLS but no write grants still receives
--     "permission denied" on any write attempt (verified locally below).
--   - default_transaction_read_only is set as defense-in-depth on top of
--     the missing write grants, never as the primary barrier.
--   - CONNECTION LIMIT 2: a scheduled daily job and, at most, one
--     concurrent manual/test invocation never need more than two sessions.
--
-- What this role CAN do, named honestly rather than hidden: read every
-- row of every tenant's data (BYPASSRLS is inherently cross-tenant - a
-- complete backup of a multi-tenant RLS database cannot avoid this by
-- construction). Compromise of this credential is a real cross-tenant
-- confidentiality risk, not eliminated by this design, only bounded to
-- "read-only, cannot corrupt or destroy data" rather than full superuser
-- blast radius.
--
-- No password is set here, by design (never commit a credential to
-- version control, migration or otherwise) - a real password is set
-- out-of-band, directly via the Supabase dashboard/SQL editor against the
-- real project, only at the point a human actually approves applying this
-- migration there, and stored solely as a GitHub Actions secret
-- thereafter. Locally, this migration leaves the role password-unset
-- (NOLOGIN-equivalent in practice until a password is assigned), and a
-- throwaway local-only password is set by hand for verification, never
-- committed anywhere.
--
-- Ownership is NOT handled by this role at all - the backup pipeline runs
-- every dump with --no-owner --no-privileges (Supabase's own documented
-- pattern for cross-environment restores), so this role never needs to
-- own anything it reads.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'backup_reader') then
    create role backup_reader with login bypassrls connection limit 2;
  end if;
end
$$;

grant pg_read_all_data to backup_reader;

alter role backup_reader set default_transaction_read_only = on;
