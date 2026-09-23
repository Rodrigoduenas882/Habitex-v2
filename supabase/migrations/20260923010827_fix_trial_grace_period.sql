-- Fix trial/grace period to match the Product Source of Truth (14-day
-- trial + 30-day grace, management access through day 44), discovered as
-- a PRODUCT/BACKEND CONTRADICTION during the INC-001 RESEARCH GATE: the
-- original trigger function (introduced in migration
-- 20260915223112_habitex_v2_008_subscription_communications_audit.sql)
-- provisioned 30 days of trial and 0 days of grace instead. See
-- docs/agentic/PROGRESS.md for the human-approved decision behind this fix.
--
-- This migration only changes:
--   1. Future provisioning: create_default_administration_trial() now
--      inserts trial_ends_at = trial_started_at + 14 days and
--      management_access_until = trial_started_at + 44 days, instead of
--      +30/+30. Every other property of the function (RETURNS trigger,
--      LANGUAGE plpgsql, SECURITY DEFINER, SET search_path = '', the
--      trigger that calls it, its grants/revokes, status='TRIALING',
--      plan_code='TRIAL') is unchanged - CREATE OR REPLACE FUNCTION on an
--      identical signature preserves existing grants automatically.
--   2. Existing data (human-approved Option B): reconciles only
--      administration_subscriptions rows that still match the old 30d/30d
--      default exactly. trial_started_at is never modified. Rows that
--      already deviate from the 30d/30d pattern for any other reason are
--      never touched. The predicate on trial_ends_at/management_access_until
--      (not just status/plan_code) makes this idempotent: once a row is
--      corrected to 14d/44d it no longer matches trial_ends_at =
--      trial_started_at + 30 days, so re-running this migration is a safe
--      no-op against already-fixed rows.
--
-- Everything else (schema, constraints, RLS, bootstrap_account,
-- active_relationship_limit, the administrations_create_trial trigger
-- definition itself) is intentionally untouched.

begin;

create or replace function public.create_default_administration_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.administration_subscriptions(
    administration_id, status, plan_code,
    trial_started_at, trial_ends_at, management_access_until
  )
  values(
    new.id, 'TRIALING', 'TRIAL',
    now(), now() + interval '14 days', now() + interval '44 days'
  );
  return new;
end
$$;

update public.administration_subscriptions
set trial_ends_at = trial_started_at + interval '14 days',
    management_access_until = trial_started_at + interval '44 days'
where status = 'TRIALING'
  and plan_code = 'TRIAL'
  and trial_started_at is not null
  and trial_ends_at is not null
  and management_access_until is not null
  and trial_ends_at = trial_started_at + interval '30 days'
  and management_access_until = trial_ends_at;

commit;
