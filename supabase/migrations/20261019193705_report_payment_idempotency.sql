-- Protects report_payment against duplicate submissions (double-click,
-- retry after a timeout/lost response, two concurrent requests, or a
-- genuinely new reload of an uncertain attempt) via a client-supplied
-- idempotency key, scoped per administration and verified against the full
-- semantic payload of the original request - deliberately NEVER
-- deduplicating based on amount/date/method/reference alone, so two
-- genuinely distinct legitimate payments that happen to share every visible
-- field (same tenant, same recurring rent amount, same day) are both
-- recorded, each under its own key.
--
-- This migration never modifies any previously-applied migration.
-- report_payment's prior 7-argument signature
-- (uuid,numeric,date,payment_method,text,uuid,text) is explicitly dropped
-- and replaced by a new 8-argument signature in the same statement, so
-- exactly one `report_payment` function exists afterward - never two
-- overloads simultaneously reachable by the same named-argument call (which
-- is how this frontend, and any Supabase RPC client, always calls it).
-- Dropping first is required, not optional: `create or replace function`
-- only replaces a function whose existing signature (the full parameter
-- type list) matches exactly - a different arity creates a second,
-- co-existing overload instead, which would make a call supplying only the
-- original 7 named arguments ambiguous between the two.
--
-- p_idempotency_key has NO default - every caller must supply one. This is
-- deliberate: the only known caller is this repo's own frontend (updated in
-- the same change), and leaving the parameter optional would silently
-- preserve the exact unprotected insert path this migration exists to
-- close. Both the migration and the frontend change must ship together;
-- deploying only one half leaves report_payment temporarily broken (a
-- caller using the old 7-argument shape gets a clean "function does not
-- exist" error, never a silent wrong-overload match) until the other half
-- also deploys.

create table public.payment_submission_keys (
  administration_id uuid not null references public.administrations(id) on delete cascade,
  idempotency_key uuid not null,
  rental_relationship_id uuid not null,
  amount numeric(14,2) not null,
  payment_date date not null,
  payment_method public.payment_method null,
  external_reference text null,
  proof_file_id uuid null,
  notes text null,
  payment_id uuid null references public.payments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (administration_id, idempotency_key)
);
create index payment_submission_keys_payment_idx on public.payment_submission_keys(payment_id) where payment_id is not null;

alter table public.payment_submission_keys enable row level security;
grant select on public.payment_submission_keys to authenticated;
revoke insert, update, delete on public.payment_submission_keys from anon, authenticated;
-- Internal control table, not read by any frontend code today - scoped to
-- administration members only (narrower than can_view_relationship), kept
-- consistent with this project's own convention of giving every RLS-enabled
-- table a real select policy rather than leaving it unreadable to everyone.
create policy payment_submission_keys_select on public.payment_submission_keys for select to authenticated using (public.is_administration_member(administration_id));

drop function if exists public.report_payment(uuid,numeric,date,public.payment_method,text,uuid,text);

create or replace function public.report_payment(
  p_relationship_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_idempotency_key uuid,
  p_method public.payment_method default null,
  p_reference text default null,
  p_proof_file_id uuid default null,
  p_notes text default null
) returns public.payments
language plpgsql security definer set search_path = '' as $$
declare
  v_r public.rental_relationships;
  v_p public.payments;
  v_person uuid := public.current_person_id();
  v_existing public.payment_submission_keys;
begin
  if v_person is null then raise exception 'ACCOUNT_REQUIRED'; end if;
  select * into v_r from public.rental_relationships where id = p_relationship_id;
  if not found or not public.can_view_relationship(p_relationship_id) then raise exception 'FORBIDDEN'; end if;
  if p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_proof_file_id is not null and not exists(
    select 1 from public.files f where f.id = p_proof_file_id and f.administration_id = v_r.administration_id and f.rental_relationship_id = v_r.id
  ) then raise exception 'INVALID_PROOF_FILE'; end if;

  -- Claim the key FIRST, before ever touching public.payments - this
  -- guarantees a payments row is only ever created once the claim has
  -- genuinely succeeded, so a caught conflict here can never leave an
  -- orphaned payment without its own idempotency record. The primary key on
  -- (administration_id, idempotency_key) is what actually serializes two
  -- truly concurrent requests: whichever INSERT reaches Postgres first wins
  -- uncontested; the second blocks on the row-level lock until the first
  -- commits (succeeds) or rolls back (then proceeds normally itself) - by
  -- the time this exception handler can ever observe the winning row, that
  -- winner's entire transaction (key insert + payment insert + payment_id
  -- backfill, below) has already committed as one atomic unit, so
  -- v_existing.payment_id is never null here.
  begin
    insert into public.payment_submission_keys(
      administration_id, idempotency_key, rental_relationship_id, amount, payment_date, payment_method, external_reference, proof_file_id, notes
    ) values (
      v_r.administration_id, p_idempotency_key, p_relationship_id, p_amount, p_payment_date, p_method, p_reference, p_proof_file_id, p_notes
    );
  exception when unique_violation then
    select * into v_existing from public.payment_submission_keys
      where administration_id = v_r.administration_id and idempotency_key = p_idempotency_key
      for update;

    if v_existing.rental_relationship_id is distinct from p_relationship_id
       or v_existing.amount is distinct from p_amount
       or v_existing.payment_date is distinct from p_payment_date
       or v_existing.payment_method is distinct from p_method
       or v_existing.external_reference is distinct from p_reference
       or v_existing.proof_file_id is distinct from p_proof_file_id
       or v_existing.notes is distinct from p_notes
    then
      raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD';
    end if;

    -- Exact replay of an already-processed request (or the loser of a
    -- genuine concurrent race with an identical payload) - return the
    -- original payment, insert nothing new.
    select * into v_p from public.payments where id = v_existing.payment_id;
    return v_p;
  end;

  insert into public.payments(administration_id, rental_relationship_id, reported_by_person_id, amount, payment_date, payment_method, external_reference, proof_file_id, notes)
    values (v_r.administration_id, v_r.id, v_person, p_amount, p_payment_date, p_method, p_reference, p_proof_file_id, p_notes)
    returning * into v_p;

  update public.payment_submission_keys set payment_id = v_p.id
    where administration_id = v_r.administration_id and idempotency_key = p_idempotency_key;

  return v_p;
end $$;

revoke all on function public.report_payment(uuid,numeric,date,uuid,public.payment_method,text,uuid,text) from public;
grant execute on function public.report_payment(uuid,numeric,date,uuid,public.payment_method,text,uuid,text) to authenticated;
