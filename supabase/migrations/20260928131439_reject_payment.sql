-- Adds reject_payment, completing the REPORTED -> REJECTED transition that
-- payment_status/payments already modeled (rejected_at column + the
-- payments_check1 CHECK constraint have existed since the original finance
-- core migration, 20260915221958_habitex_v2_006_finance_core.sql) but that
-- no RPC ever implemented - confirmed during the INC-013 RESEARCH GATE:
-- public.payments has only a SELECT RLS policy (payments_select), and no
-- function anywhere in the schema ever wrote status='REJECTED'. This
-- migration adds exactly the missing RPC, mirroring confirm_payment's own
-- conventions (SECURITY DEFINER, same search_path hardening, same
-- authorization function, same row-locking, same REVOKE/GRANT pattern).
-- See docs/agentic/PROGRESS.md for the human-approved decision to author
-- this migration; it is NOT applied automatically - applying any migration
-- against the real project always requires a separate, explicit human
-- approval (CLAUDE.md §5), never implicit from authoring it.
--
-- Scope, deliberately minimal (mirrors the human decision precisely):
--   - REPORTED -> REJECTED only, no reason required. rejection_reason
--     already exists as a nullable column from the original schema - this
--     RPC never populates it, matching the explicit "rejection does not
--     require a reason for MVP" decision. Existing `notes` (written by
--     report_payment) is never touched or overwritten.
--   - No CANCELLED transition, no payment edit/delete RPC, no new column,
--     no direct UPDATE RLS policy - public.payments remains RPC-write-only
--     (report_payment for INSERT, confirm_payment/reject_payment for the
--     only two UPDATE paths), exactly as before.
--   - Same authorization as confirm_payment (can_manage_administration),
--     same `for update` row lock, same PAYMENT_NOT_REPORTED guard (reusing
--     the exact same exception string confirm_payment already raises for
--     the identical precondition, per the project's existing error
--     convention) - so confirm_payment and reject_payment racing against
--     the same REPORTED payment are safe under concurrency: the row lock
--     serializes the two calls, whichever commits first wins the
--     transition, and the second call's own status check (now reading the
--     already-updated row) fails cleanly with PAYMENT_NOT_REPORTED instead
--     of double-transitioning or silently succeeding.
--   - Zero financial side effect by construction - the function body only
--     ever reads/writes public.payments (status, rejected_at); it never
--     touches payment_allocations, charges, charge_balances, receipts or
--     files, so charge_balances' behavior (which only counts CONFIRMED
--     payments through payment_allocations) is entirely unaffected by a
--     rejection, exactly as required.
--   - updated_at is left unset in the UPDATE statement, same as
--     confirm_payment - the existing payments_updated_at trigger
--     (execute function public.set_updated_at(), already installed by the
--     original finance core migration) maintains it automatically on
--     every UPDATE to public.payments.
--
-- Everything else (public.payments' own schema, every other table/RLS/RPC
-- in this project) is intentionally untouched.

create or replace function public.reject_payment(p_payment_id uuid)
returns public.payments
language plpgsql security definer set search_path = '' as $$
declare v_p public.payments;
begin
  select * into v_p from public.payments where id = p_payment_id for update;
  if not found or not public.can_manage_administration(v_p.administration_id) then
    raise exception 'FORBIDDEN';
  end if;
  if v_p.status <> 'REPORTED' then
    raise exception 'PAYMENT_NOT_REPORTED';
  end if;
  update public.payments
    set status = 'REJECTED', rejected_at = now()
    where id = v_p.id
    returning * into v_p;
  return v_p;
end $$;

revoke all on function public.reject_payment(uuid) from public;
grant execute on function public.reject_payment(uuid) to authenticated;
