create table public.rental_subject_occupancies (
  rental_subject_id uuid primary key,
  rental_relationship_id uuid not null,
  administration_id uuid not null,
  occupied_at timestamptz not null default now(),
  constraint rental_subject_occupancies_admin_fk foreign key (administration_id) references public.administrations(id) on delete cascade,
  constraint rental_subject_occupancies_subject_fk foreign key (administration_id, rental_subject_id) references public.rental_subjects(administration_id, id) on delete restrict,
  constraint rental_subject_occupancies_relationship_fk foreign key (administration_id, rental_relationship_id) references public.rental_relationships(administration_id, id) on delete cascade
);

create index rental_subject_occupancies_relationship_idx on public.rental_subject_occupancies(rental_relationship_id);
create index rental_subject_occupancies_admin_idx on public.rental_subject_occupancies(administration_id);

alter table public.rental_subject_occupancies enable row level security;
grant select on public.rental_subject_occupancies to authenticated;
revoke insert, update, delete on public.rental_subject_occupancies from anon, authenticated;

create policy rental_subject_occupancies_select on public.rental_subject_occupancies
for select to authenticated
using (public.is_administration_member(administration_id) or public.can_view_relationship(rental_relationship_id));

insert into public.rental_subject_occupancies(rental_subject_id,rental_relationship_id,administration_id,occupied_at)
select rs.rental_subject_id, rs.rental_relationship_id, rs.administration_id, coalesce(rr.activated_at,rr.created_at,now())
from public.rental_relationship_subjects rs
join public.rental_relationships rr on rr.id=rs.rental_relationship_id
where rr.status in ('ACTIVE','ENDING');

create or replace function public.relationship_capacity_available(p_administration_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select coalesce((select case when s.active_relationship_limit is null then true else public.active_relationship_count(p_administration_id) < s.active_relationship_limit end
 from public.administration_subscriptions s where s.administration_id=p_administration_id), false)
$$;

create or replace function public.activate_rental_relationship(p_relationship_id uuid)
returns public.rental_relationships language plpgsql security definer set search_path=''
as $$
declare
 v_r public.rental_relationships;
 v_sub public.administration_subscriptions;
begin
 select * into v_r from public.rental_relationships where id=p_relationship_id for update;
 if not found then raise exception 'RENTAL_NOT_FOUND'; end if;
 if public.can_manage_administration(v_r.administration_id) is not true then raise exception 'MANAGEMENT_ACCESS_REQUIRED'; end if;
 if v_r.status<>'DRAFT' then raise exception 'RENTAL_NOT_DRAFT'; end if;

 select * into v_sub from public.administration_subscriptions where administration_id=v_r.administration_id for update;
 if not found or v_sub.status not in ('TRIALING','ACTIVE','PAST_DUE','CANCELED') or (v_sub.management_access_until is not null and v_sub.management_access_until < now()) then
   raise exception 'MANAGEMENT_ACCESS_REQUIRED';
 end if;
 if v_sub.active_relationship_limit is not null and public.active_relationship_count(v_r.administration_id) >= v_sub.active_relationship_limit then
   raise exception 'RELATIONSHIP_CAPACITY_REACHED';
 end if;
 if v_r.real_start_date is null or v_r.tracking_start_date is null or v_r.payment_day is null or v_r.payment_timing is null then raise exception 'RENTAL_TERMS_INCOMPLETE'; end if;
 if (select count(*) from public.rental_relationship_subjects s where s.rental_relationship_id=v_r.id and s.subject_role='PRIMARY')<>1 then raise exception 'PRIMARY_SUBJECT_REQUIRED'; end if;
 if (select count(*) from public.rental_participants p where p.rental_relationship_id=v_r.id and p.participation_type='TENANT' and p.status='ACTIVE')<>1 then raise exception 'ACTIVE_TENANT_REQUIRED'; end if;
 if (select count(*) from public.rental_participants p where p.rental_relationship_id=v_r.id and p.participation_type='LESSOR' and p.status='ACTIVE')<>1 then raise exception 'ACTIVE_LESSOR_REQUIRED'; end if;
 if not exists(select 1 from public.rental_term_versions t where t.rental_relationship_id=v_r.id and t.effective_from<=v_r.real_start_date and (t.effective_until is null or t.effective_until>=v_r.real_start_date)) then raise exception 'INITIAL_TERM_VERSION_REQUIRED'; end if;

 begin
   insert into public.rental_subject_occupancies(rental_subject_id,rental_relationship_id,administration_id)
   select s.rental_subject_id,s.rental_relationship_id,s.administration_id
   from public.rental_relationship_subjects s where s.rental_relationship_id=v_r.id;
 exception when unique_violation then
   raise exception 'RENTAL_SUBJECT_ALREADY_IN_USE';
 end;

 update public.rental_relationships set status='ACTIVE',activated_at=now() where id=v_r.id returning * into v_r;
 return v_r;
end $$;

create or replace function public.end_rental(p_relationship_id uuid, p_actual_end_date date default current_date)
returns public.rental_relationships language plpgsql security definer set search_path=''
as $$
declare v_r public.rental_relationships;
begin
 select * into v_r from public.rental_relationships where id=p_relationship_id for update;
 if not found then raise exception 'RENTAL_NOT_FOUND'; end if;
 if public.can_manage_administration(v_r.administration_id) is not true then raise exception 'MANAGEMENT_ACCESS_REQUIRED'; end if;
 if v_r.status not in ('ACTIVE','ENDING') then raise exception 'RENTAL_NOT_ENDABLE'; end if;
 if p_actual_end_date < v_r.real_start_date then raise exception 'END_BEFORE_START'; end if;
 update public.rental_relationships set status='ENDED',actual_end_date=p_actual_end_date,ended_at=now() where id=v_r.id returning * into v_r;
 update public.rental_participants set status='ENDED',ends_on=coalesce(ends_on,p_actual_end_date) where rental_relationship_id=v_r.id and status='ACTIVE';
 delete from public.rental_subject_occupancies where rental_relationship_id=v_r.id;
 return v_r;
end $$;

revoke all on function public.relationship_capacity_available(uuid) from public, anon, authenticated;
grant execute on function public.relationship_capacity_available(uuid) to postgres, service_role;
grant execute on function public.activate_rental_relationship(uuid) to authenticated, service_role;
grant execute on function public.end_rental(uuid,date) to authenticated, service_role;