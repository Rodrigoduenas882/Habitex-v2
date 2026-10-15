-- Subscription/capacity, communications and audit foundation.
create type public.subscription_status as enum ('TRIALING','ACTIVE','PAST_DUE','CANCELED','EXPIRED');
create type public.communication_channel as enum ('EMAIL','IN_APP');
create type public.communication_status as enum ('QUEUED','SENT','DELIVERED','FAILED','CANCELED');

create table public.administration_subscriptions (
 id uuid primary key default gen_random_uuid(),
 administration_id uuid not null unique references public.administrations(id) on delete cascade,
 status public.subscription_status not null default 'TRIALING',
 plan_code text not null default 'TRIAL',
 trial_started_at timestamptz null,
 trial_ends_at timestamptz null,
 current_period_starts_at timestamptz null,
 current_period_ends_at timestamptz null,
 management_access_until timestamptz null,
 active_relationship_limit integer null check(active_relationship_limit is null or active_relationship_limit > 0),
 provider text null,
 provider_customer_id text null,
 provider_subscription_id text null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(status <> 'TRIALING' or (trial_started_at is not null and trial_ends_at is not null and trial_ends_at > trial_started_at))
);
create index administration_subscriptions_status_idx on public.administration_subscriptions(status,management_access_until);
create trigger administration_subscriptions_updated_at before update on public.administration_subscriptions for each row execute function public.set_updated_at();

create or replace function public.create_default_administration_trial() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.administration_subscriptions(administration_id,status,plan_code,trial_started_at,trial_ends_at,management_access_until)
 values(new.id,'TRIALING','TRIAL',now(),now()+interval '30 days',now()+interval '30 days');
 return new;
end $$;
revoke all on function public.create_default_administration_trial() from public,anon,authenticated;
create trigger administrations_create_trial after insert on public.administrations for each row execute function public.create_default_administration_trial();

create or replace function public.has_administration_management_role(p_administration_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.administration_members m join public.administrations a on a.id=m.administration_id where m.administration_id=p_administration_id and m.person_id=public.current_person_id() and m.status='ACTIVE' and m.role in ('OWNER','MANAGER') and a.status='ACTIVE')
$$;
revoke all on function public.has_administration_management_role(uuid) from public,anon,authenticated;

create or replace function public.has_management_access(p_administration_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.administration_subscriptions s where s.administration_id=p_administration_id and s.status in ('TRIALING','ACTIVE','PAST_DUE','CANCELED') and (s.management_access_until is null or s.management_access_until >= now()))
$$;
revoke all on function public.has_management_access(uuid) from public,anon,authenticated;

-- From this point, can_manage means both permission and current management entitlement.
create or replace function public.can_manage_administration(p_administration_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.has_administration_management_role(p_administration_id) and public.has_management_access(p_administration_id)
$$;
revoke all on function public.can_manage_administration(uuid) from public,anon,authenticated;

create or replace function public.active_relationship_count(p_administration_id uuid) returns integer language sql stable security definer set search_path='' as $$
 select count(*)::integer from public.rental_relationships r where r.administration_id=p_administration_id and r.status in ('ACTIVE','ENDING')
$$;
revoke all on function public.active_relationship_count(uuid) from public,anon,authenticated;

create or replace function public.relationship_capacity_available(p_administration_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case when s.active_relationship_limit is null then true else public.active_relationship_count(p_administration_id) < s.active_relationship_limit end
 from public.administration_subscriptions s where s.administration_id=p_administration_id
$$;
revoke all on function public.relationship_capacity_available(uuid) from public,anon,authenticated;

-- Capacity is deliberately configurable. No commercial limit is hard-coded until pricing is finalized.
create or replace function public.activate_rental_relationship(p_relationship_id uuid) returns public.rental_relationships language plpgsql security definer set search_path='' as $$
declare v_r public.rental_relationships; v_conflict boolean;
begin
 select * into v_r from public.rental_relationships where id=p_relationship_id for update;
 if not found then raise exception 'RENTAL_NOT_FOUND'; end if;
 if not public.can_manage_administration(v_r.administration_id) then raise exception 'MANAGEMENT_ACCESS_REQUIRED'; end if;
 if not public.relationship_capacity_available(v_r.administration_id) then raise exception 'RELATIONSHIP_CAPACITY_REACHED'; end if;
 if v_r.status<>'DRAFT' then raise exception 'RENTAL_NOT_DRAFT'; end if;
 if v_r.real_start_date is null or v_r.tracking_start_date is null or v_r.payment_day is null or v_r.payment_timing is null then raise exception 'RENTAL_TERMS_INCOMPLETE'; end if;
 if (select count(*) from public.rental_relationship_subjects s where s.rental_relationship_id=v_r.id and s.subject_role='PRIMARY')<>1 then raise exception 'PRIMARY_SUBJECT_REQUIRED'; end if;
 if (select count(*) from public.rental_participants p where p.rental_relationship_id=v_r.id and p.participation_type='TENANT' and p.status='ACTIVE')<>1 then raise exception 'ACTIVE_TENANT_REQUIRED'; end if;
 if (select count(*) from public.rental_participants p where p.rental_relationship_id=v_r.id and p.participation_type='LESSOR' and p.status='ACTIVE')<>1 then raise exception 'ACTIVE_LESSOR_REQUIRED'; end if;
 if not exists(select 1 from public.rental_term_versions t where t.rental_relationship_id=v_r.id and t.effective_from<=v_r.real_start_date and (t.effective_until is null or t.effective_until>=v_r.real_start_date)) then raise exception 'INITIAL_TERM_VERSION_REQUIRED'; end if;
 select exists(select 1 from public.rental_relationship_subjects mine join public.rental_relationship_subjects other on other.rental_subject_id=mine.rental_subject_id join public.rental_relationships rr on rr.id=other.rental_relationship_id where mine.rental_relationship_id=v_r.id and other.rental_relationship_id<>v_r.id and rr.status in ('ACTIVE','ENDING')) into v_conflict;
 if v_conflict then raise exception 'RENTAL_SUBJECT_ALREADY_IN_USE'; end if;
 update public.rental_relationships set status='ACTIVE',activated_at=now() where id=v_r.id returning * into v_r;
 return v_r;
end $$;
revoke all on function public.activate_rental_relationship(uuid) from public,anon;
grant execute on function public.activate_rental_relationship(uuid) to authenticated;

-- Fix tenant relationship SELECT policy: previous generated alias expression compared rp.rental_relationship_id to rp.id.
drop policy if exists rental_relationships_select on public.rental_relationships;
create policy rental_relationships_select on public.rental_relationships for select to authenticated using(public.can_view_relationship(id));

alter table public.administration_subscriptions enable row level security;
create policy administration_subscriptions_select on public.administration_subscriptions for select to authenticated using(public.is_administration_member(administration_id));
-- Billing/subscription state is intentionally not directly mutable by the client. Future provider webhook/Edge Function owns writes.

create table public.communication_events (
 id uuid primary key default gen_random_uuid(),
 administration_id uuid not null references public.administrations(id) on delete cascade,
 rental_relationship_id uuid null references public.rental_relationships(id) on delete set null,
 recipient_person_id uuid null references public.people(id) on delete set null,
 recipient_address text null,
 channel public.communication_channel not null,
 event_type text not null,
 template_key text null,
 rendered_subject text null,
 rendered_body_text text null,
 payload jsonb not null default '{}'::jsonb,
 created_by_person_id uuid null references public.people(id) on delete set null,
 created_at timestamptz not null default now(),
 check(recipient_person_id is not null or nullif(trim(recipient_address),'') is not null)
);
create index communication_events_admin_idx on public.communication_events(administration_id,created_at desc);
create index communication_events_relationship_idx on public.communication_events(rental_relationship_id) where rental_relationship_id is not null;
create index communication_events_recipient_idx on public.communication_events(recipient_person_id) where recipient_person_id is not null;

create table public.communication_deliveries (
 id uuid primary key default gen_random_uuid(),
 communication_event_id uuid not null references public.communication_events(id) on delete cascade,
 status public.communication_status not null default 'QUEUED',
 provider text null,
 provider_message_id text null,
 attempt_number integer not null default 1 check(attempt_number>0),
 error_code text null,
 error_message text null,
 queued_at timestamptz not null default now(),
 sent_at timestamptz null,
 delivered_at timestamptz null,
 failed_at timestamptz null,
 created_at timestamptz not null default now(),
 unique(communication_event_id,attempt_number)
);
create index communication_deliveries_event_idx on public.communication_deliveries(communication_event_id);
create index communication_deliveries_status_idx on public.communication_deliveries(status,created_at);

create table public.audit_events (
 id bigint generated always as identity primary key,
 administration_id uuid null references public.administrations(id) on delete set null,
 rental_relationship_id uuid null references public.rental_relationships(id) on delete set null,
 actor_person_id uuid null references public.people(id) on delete set null,
 action text not null,
 entity_type text not null,
 entity_id uuid null,
 metadata jsonb not null default '{}'::jsonb,
 occurred_at timestamptz not null default now()
);
create index audit_events_admin_time_idx on public.audit_events(administration_id,occurred_at desc);
create index audit_events_relationship_time_idx on public.audit_events(rental_relationship_id,occurred_at desc) where rental_relationship_id is not null;
create index audit_events_actor_idx on public.audit_events(actor_person_id) where actor_person_id is not null;

create or replace function public.audit_domain_row_change() returns trigger language plpgsql security definer set search_path='' as $$
declare v_row jsonb; v_old jsonb; v_admin uuid; v_rel uuid; v_id uuid; v_meta jsonb;
begin
 v_row:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 v_old:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
 v_admin:=nullif(v_row->>'administration_id','')::uuid;
 v_rel:=nullif(v_row->>'rental_relationship_id','')::uuid;
 if v_rel is null and tg_table_name='rental_relationships' then v_rel:=nullif(v_row->>'id','')::uuid; end if;
 v_id:=nullif(v_row->>'id','')::uuid;
 v_meta:=jsonb_strip_nulls(jsonb_build_object('operation',tg_op,'old_status',v_old->>'status','new_status',v_row->>'status'));
 insert into public.audit_events(administration_id,rental_relationship_id,actor_person_id,action,entity_type,entity_id,metadata)
 values(v_admin,v_rel,public.current_person_id(),tg_op,tg_table_name,v_id,v_meta);
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function public.audit_domain_row_change() from public,anon,authenticated;
create trigger audit_rental_relationships after insert or update or delete on public.rental_relationships for each row execute function public.audit_domain_row_change();
create trigger audit_payments after insert or update or delete on public.payments for each row execute function public.audit_domain_row_change();
create trigger audit_contracts after insert or update or delete on public.contracts for each row execute function public.audit_domain_row_change();
create trigger audit_acts after insert or update or delete on public.acts for each row execute function public.audit_domain_row_change();

alter table public.communication_events enable row level security;
alter table public.communication_deliveries enable row level security;
alter table public.audit_events enable row level security;

create policy communication_events_select on public.communication_events for select to authenticated using(public.is_administration_member(administration_id) or recipient_person_id=public.current_person_id() or (rental_relationship_id is not null and public.can_view_relationship(rental_relationship_id)));
-- Events/delivery attempts are created by the backend/Edge Function, not directly by browser clients.
create policy communication_deliveries_select on public.communication_deliveries for select to authenticated using(exists(select 1 from public.communication_events e where e.id=communication_event_id and (public.is_administration_member(e.administration_id) or e.recipient_person_id=public.current_person_id() or (e.rental_relationship_id is not null and public.can_view_relationship(e.rental_relationship_id)))));
create policy audit_events_select on public.audit_events for select to authenticated using(administration_id is not null and public.is_administration_member(administration_id));
