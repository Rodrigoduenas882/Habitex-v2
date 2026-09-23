-- Habitex V2 financial ledger. Habitex records obligations/payments; it does not custody rent money.
create type public.charge_type as enum ('RENT','ADMINISTRATION','UTILITY','OTHER');
create type public.charge_origin as enum ('SYSTEM','MANUAL','UTILITY_ALLOCATION');
create type public.payment_status as enum ('REPORTED','CONFIRMED','REJECTED','CANCELLED');
create type public.payment_method as enum ('BANK_TRANSFER','CASH','DIGITAL_WALLET','OTHER');
create type public.receipt_status as enum ('ISSUED','VOIDED');

create table public.charges (
 id uuid primary key default gen_random_uuid(),
 administration_id uuid not null references public.administrations(id) on delete cascade,
 rental_relationship_id uuid not null references public.rental_relationships(id) on delete cascade,
 charge_type public.charge_type not null,
 origin public.charge_origin not null default 'SYSTEM',
 description text not null,
 period_start date null,
 period_end date null,
 due_date date not null,
 amount numeric(14,2) not null check(amount>0),
 currency char(3) not null default 'COP' check(currency='COP'),
 source_type text null,
 source_id uuid null,
 created_at timestamptz not null default now(),
 unique(rental_relationship_id,charge_type,period_start,period_end,source_type,source_id),
 check(period_end is null or period_start is not null),
 check(period_end is null or period_end>=period_start)
);
create index charges_admin_due_idx on public.charges(administration_id,due_date);
create index charges_relationship_due_idx on public.charges(rental_relationship_id,due_date);

create table public.payments (
 id uuid primary key default gen_random_uuid(),
 administration_id uuid not null references public.administrations(id) on delete cascade,
 rental_relationship_id uuid not null references public.rental_relationships(id) on delete cascade,
 reported_by_person_id uuid null references public.people(id) on delete set null,
 confirmed_by_person_id uuid null references public.people(id) on delete set null,
 status public.payment_status not null default 'REPORTED',
 amount numeric(14,2) not null check(amount>0),
 currency char(3) not null default 'COP' check(currency='COP'),
 payment_date date not null,
 payment_method public.payment_method null,
 external_reference text null,
 proof_file_id uuid null references public.files(id) on delete restrict,
 notes text null,
 reported_at timestamptz not null default now(),
 confirmed_at timestamptz null,
 rejected_at timestamptz null,
 rejection_reason text null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((status='CONFIRMED' and confirmed_at is not null and confirmed_by_person_id is not null) or status<>'CONFIRMED'),
 check((status='REJECTED' and rejected_at is not null) or status<>'REJECTED')
);
create index payments_admin_date_idx on public.payments(administration_id,payment_date desc);
create index payments_relationship_status_idx on public.payments(rental_relationship_id,status);

create table public.payment_allocations (
 id uuid primary key default gen_random_uuid(),
 administration_id uuid not null references public.administrations(id) on delete cascade,
 payment_id uuid not null references public.payments(id) on delete cascade,
 charge_id uuid not null references public.charges(id) on delete restrict,
 amount numeric(14,2) not null check(amount>0),
 created_at timestamptz not null default now(),
 unique(payment_id,charge_id)
);
create index payment_allocations_charge_idx on public.payment_allocations(charge_id);

create table public.receipts (
 id uuid primary key default gen_random_uuid(),
 administration_id uuid not null references public.administrations(id) on delete cascade,
 rental_relationship_id uuid not null references public.rental_relationships(id) on delete cascade,
 payment_id uuid not null unique references public.payments(id) on delete restrict,
 receipt_number bigint generated always as identity,
 status public.receipt_status not null default 'ISSUED',
 file_id uuid null references public.files(id) on delete restrict,
 issued_at timestamptz not null default now(),
 voided_at timestamptz null,
 void_reason text null,
 created_at timestamptz not null default now(),
 check((status='VOIDED' and voided_at is not null) or status='ISSUED')
);
create index receipts_admin_number_idx on public.receipts(administration_id,receipt_number);
create index receipts_relationship_idx on public.receipts(rental_relationship_id);

create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();

create or replace function public.validate_financial_administration() returns trigger language plpgsql set search_path='' as $$ begin
 if not exists(select 1 from public.rental_relationships r where r.id=new.rental_relationship_id and r.administration_id=new.administration_id) then raise exception 'RELATIONSHIP_ADMINISTRATION_MISMATCH'; end if;
 return new; end $$;
create trigger charges_validate_admin before insert or update on public.charges for each row execute function public.validate_financial_administration();
create trigger payments_validate_admin before insert or update on public.payments for each row execute function public.validate_financial_administration();
create trigger receipts_validate_admin before insert or update on public.receipts for each row execute function public.validate_financial_administration();

create or replace function public.validate_payment_allocation() returns trigger language plpgsql set search_path='' as $$
declare v_payment public.payments; v_charge public.charges; v_payment_alloc numeric(14,2); v_charge_alloc numeric(14,2);
begin
 select * into v_payment from public.payments where id=new.payment_id for update;
 select * into v_charge from public.charges where id=new.charge_id for update;
 if v_payment.id is null or v_charge.id is null then raise exception 'PAYMENT_OR_CHARGE_NOT_FOUND'; end if;
 if v_payment.status<>'CONFIRMED' then raise exception 'PAYMENT_NOT_CONFIRMED'; end if;
 if v_payment.administration_id<>new.administration_id or v_charge.administration_id<>new.administration_id or v_payment.rental_relationship_id<>v_charge.rental_relationship_id then raise exception 'ALLOCATION_SCOPE_MISMATCH'; end if;
 select coalesce(sum(pa.amount),0) into v_payment_alloc from public.payment_allocations pa where pa.payment_id=new.payment_id and pa.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid);
 select coalesce(sum(pa.amount),0) into v_charge_alloc from public.payment_allocations pa join public.payments p on p.id=pa.payment_id where pa.charge_id=new.charge_id and p.status='CONFIRMED' and pa.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid);
 if v_payment_alloc+new.amount>v_payment.amount then raise exception 'ALLOCATION_EXCEEDS_PAYMENT'; end if;
 if v_charge_alloc+new.amount>v_charge.amount then raise exception 'ALLOCATION_EXCEEDS_CHARGE'; end if;
 return new;
end $$;
create trigger payment_allocations_validate before insert or update on public.payment_allocations for each row execute function public.validate_payment_allocation();

create or replace function public.report_payment(p_relationship_id uuid,p_amount numeric,p_payment_date date,p_method public.payment_method default null,p_reference text default null,p_proof_file_id uuid default null,p_notes text default null) returns public.payments
language plpgsql security definer set search_path='' as $$
declare v_r public.rental_relationships; v_p public.payments; v_person uuid:=public.current_person_id();
begin
 if v_person is null then raise exception 'ACCOUNT_REQUIRED'; end if;
 select * into v_r from public.rental_relationships where id=p_relationship_id;
 if not found or not public.can_view_relationship(p_relationship_id) then raise exception 'FORBIDDEN'; end if;
 if p_amount<=0 then raise exception 'INVALID_AMOUNT'; end if;
 if p_proof_file_id is not null and not exists(select 1 from public.files f where f.id=p_proof_file_id and f.administration_id=v_r.administration_id and f.rental_relationship_id=v_r.id) then raise exception 'INVALID_PROOF_FILE'; end if;
 insert into public.payments(administration_id,rental_relationship_id,reported_by_person_id,amount,payment_date,payment_method,external_reference,proof_file_id,notes) values(v_r.administration_id,v_r.id,v_person,p_amount,p_payment_date,p_method,p_reference,p_proof_file_id,p_notes) returning * into v_p;
 return v_p;
end $$;
revoke all on function public.report_payment(uuid,numeric,date,public.payment_method,text,uuid,text) from public;
grant execute on function public.report_payment(uuid,numeric,date,public.payment_method,text,uuid,text) to authenticated;

create or replace function public.confirm_payment(p_payment_id uuid) returns public.payments
language plpgsql security definer set search_path='' as $$
declare v_p public.payments; v_person uuid:=public.current_person_id();
begin
 select * into v_p from public.payments where id=p_payment_id for update;
 if not found or not public.can_manage_administration(v_p.administration_id) then raise exception 'FORBIDDEN'; end if;
 if v_p.status<>'REPORTED' then raise exception 'PAYMENT_NOT_REPORTED'; end if;
 update public.payments set status='CONFIRMED',confirmed_by_person_id=v_person,confirmed_at=now() where id=v_p.id returning * into v_p;
 return v_p;
end $$;
revoke all on function public.confirm_payment(uuid) from public;
grant execute on function public.confirm_payment(uuid) to authenticated;

create or replace function public.allocate_payment(p_payment_id uuid,p_charge_id uuid,p_amount numeric) returns public.payment_allocations
language plpgsql security definer set search_path='' as $$
declare v_p public.payments; v_a public.payment_allocations;
begin
 select * into v_p from public.payments where id=p_payment_id;
 if not found or not public.can_manage_administration(v_p.administration_id) then raise exception 'FORBIDDEN'; end if;
 insert into public.payment_allocations(administration_id,payment_id,charge_id,amount) values(v_p.administration_id,p_payment_id,p_charge_id,p_amount) returning * into v_a;
 return v_a;
end $$;
revoke all on function public.allocate_payment(uuid,uuid,numeric) from public;
grant execute on function public.allocate_payment(uuid,uuid,numeric) to authenticated;

create or replace function public.issue_receipt(p_payment_id uuid) returns public.receipts
language plpgsql security definer set search_path='' as $$
declare v_p public.payments; v_r public.receipts;
begin
 select * into v_p from public.payments where id=p_payment_id for update;
 if not found or not public.can_manage_administration(v_p.administration_id) then raise exception 'FORBIDDEN'; end if;
 if v_p.status<>'CONFIRMED' then raise exception 'PAYMENT_NOT_CONFIRMED'; end if;
 if not exists(select 1 from public.payment_allocations pa where pa.payment_id=v_p.id) then raise exception 'PAYMENT_HAS_NO_ALLOCATIONS'; end if;
 insert into public.receipts(administration_id,rental_relationship_id,payment_id) values(v_p.administration_id,v_p.rental_relationship_id,v_p.id) returning * into v_r;
 return v_r;
end $$;
revoke all on function public.issue_receipt(uuid) from public;
grant execute on function public.issue_receipt(uuid) to authenticated;

create view public.charge_balances with (security_invoker=true) as
select c.id as charge_id,c.administration_id,c.rental_relationship_id,c.amount,
       coalesce(sum(pa.amount) filter(where p.status='CONFIRMED'),0)::numeric(14,2) as paid_amount,
       (c.amount-coalesce(sum(pa.amount) filter(where p.status='CONFIRMED'),0))::numeric(14,2) as balance,
       case when c.amount-coalesce(sum(pa.amount) filter(where p.status='CONFIRMED'),0)<=0 then 'PAID'
            when coalesce(sum(pa.amount) filter(where p.status='CONFIRMED'),0)>0 then 'PARTIAL'
            when c.due_date<current_date then 'OVERDUE' else 'PENDING' end as financial_status
from public.charges c left join public.payment_allocations pa on pa.charge_id=c.id left join public.payments p on p.id=pa.payment_id
group by c.id;

alter table public.charges enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.receipts enable row level security;

create policy charges_select on public.charges for select to authenticated using(public.can_view_relationship(rental_relationship_id));
create policy charges_insert_manager on public.charges for insert to authenticated with check(public.can_manage_administration(administration_id));
create policy charges_update_manager on public.charges for update to authenticated using(public.can_manage_administration(administration_id)) with check(public.can_manage_administration(administration_id));

create policy payments_select on public.payments for select to authenticated using(public.can_view_relationship(rental_relationship_id));
-- No direct INSERT/confirmation: use report_payment / confirm_payment.
create policy payment_allocations_select on public.payment_allocations for select to authenticated using(exists(select 1 from public.payments p where p.id=payment_id and public.can_view_relationship(p.rental_relationship_id)));
create policy receipts_select on public.receipts for select to authenticated using(public.can_view_relationship(rental_relationship_id));
