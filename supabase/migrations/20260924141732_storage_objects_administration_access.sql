-- RLS for storage.objects (Supabase Storage), discovered missing entirely
-- during the INC-010 RESEARCH GATE ("Generic file upload/download
-- primitive"): storage.objects has RLS enabled (relrowsecurity = true) but
-- zero policies existed before this migration, for either of the two
-- existing buckets (`receipts`, `documents`, both private). With RLS
-- enabled and no matching policy, every operation was denied by default -
-- Supabase Storage was completely unreachable from the frontend. This
-- directly contradicted the completion plan's assumption ("Existing
-- Supabase support: completo... Backend work required?: no") for INC-010.
-- See docs/agentic/PROGRESS.md for the human-approved decision to author
-- this migration; it was NOT applied automatically - applying any migration
-- against the real project always requires a separate, explicit human
-- approval (CLAUDE.md §5), never implicit from authoring it.
--
-- Correction after independent review: `authenticated` and `anon` already
-- hold full default table privileges on storage.objects, granted by
-- `supabase_storage_admin` - this is Supabase's standard Storage schema
-- setup on every project, not something this repo (or the absence of a
-- prior migration) caused, and not something this migration needs to grant.
-- RLS policy absence was the entire gap; adding a redundant GRANT would not
-- fix anything and would misrepresent what's actually protecting this
-- table (RLS, not table privileges - identical to every other table in
-- this project). This migration therefore only adds policies, nothing
-- else.
--
-- Scope, deliberately minimal (matches INC-010's own "no final
-- retention/storage policy" out-of-scope note):
--   - Three RLS policies, scoped to the two buckets that exist today
--     (`receipts`, `documents`) and to the caller's administration
--     membership, read from the object path's first path segment
--     (storage.foldername(name)[1]), matching the already-established
--     convention of the public.files table's own RLS
--     (files_select/files_insert/files_delete) and this project's general
--     <table>_<action> policy naming:
--       - objects_select: any administration member can read
--         (is_administration_member) - broader than management, matches
--         files_select's administration side (the rental-participant side
--         of files_select has no equivalent here, since Storage objects
--         don't carry a rental_relationship_id column to check against - a
--         future increment that needs tenant-scoped file access can extend
--         this, not INC-010).
--       - objects_insert/objects_delete: only an administration manager
--         with current management access can write
--         (can_manage_administration) - same gate as
--         files_insert/files_delete.
--   - No UPDATE policy, deliberately - objects are immutable once uploaded,
--     same principle already established for public.files (no update
--     policy there either). This means the future upload primitive must
--     never call Storage's upload() with `upsert: true` against these
--     buckets (that internally requires UPDATE privilege via an
--     INSERT ... ON CONFLICT DO UPDATE - it would be denied) - always
--     construct a fresh, unique path per upload instead. A later migration
--     would need to add an UPDATE policy deliberately if replace-in-place
--     semantics are ever wanted.
--   - Path convention this establishes going forward: every object's name
--     must start with `{administration_id}/...` for these policies to
--     grant any access - this is an application-level convention the
--     frontend must follow when uploading (the INC-010 upload primitive is
--     responsible for constructing paths this way), not something the
--     database enforces beyond what these policies already gate. A
--     malformed first path segment that isn't a valid UUID surfaces as a
--     Postgres cast error (22P02), not a graceful RLS denial - still a
--     deny (no operation succeeds), just a less graceful one; acceptable
--     since path construction is entirely application-controlled.
--
-- Everything else (public.files itself, its own RLS, the two bucket rows,
-- table-level grants on storage.objects, every other table/RLS/RPC in this
-- project) is intentionally untouched.

begin;

create policy objects_select
on storage.objects
for select
to authenticated
using (
  bucket_id in ('receipts', 'documents')
  and public.is_administration_member((storage.foldername(name))[1]::uuid)
);

create policy objects_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('receipts', 'documents')
  and public.can_manage_administration((storage.foldername(name))[1]::uuid)
);

create policy objects_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('receipts', 'documents')
  and public.can_manage_administration((storage.foldername(name))[1]::uuid)
);

commit;
