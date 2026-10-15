create table public.rental_subject_sublease_occupancies (
  rental_subject_id uuid primary key references public.rental_subjects(id) on delete cascade,
  rental_relationship_id uuid not null unique references public.rental_relationships(id) on delete cascade,
  source_relationship_id uuid not null references public.rental_relationships(id) on delete restrict,
  administration_id uuid not null references public.administrations(id) on delete cascade,
  asset_right_id uuid not null references public.asset_rights(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.rental_subject_sublease_occupancies enable row level security;
create policy rental_subject_sublease_occupancies_select on public.rental_subject_sublease_occupancies for select to authenticated using (is_administration_member(administration_id) or can_view_relationship(rental_relationship_id));
grant select on public.rental_subject_sublease_occupancies to authenticated;

create or replace function public.activate_rental_relationship(p_relationship_id uuid)
returns public.rental_relationships language plpgsql security definer set search_path='' as $$
declare v_r public.rental_relationships; v_sub public.administration_subscriptions; x record; existing_rel uuid; ar public.asset_rights; lessor_id uuid;
begin
 select * into v_r from public.rental_relationships where id=p_relationship_id for update;
 if not found then raise exception 'RENTAL_NOT_FOUND'; end if;
 if public.can_manage_administration(v_r.administration_id) is not true then raise exception 'MANAGEMENT_ACCESS_REQUIRED'; end if;
 if v_r.status<>'DRAFT' then raise exception 'RENTAL_NOT_DRAFT'; end if;
 select * into v_sub from public.administration_subscriptions where administration_id=v_r.administration_id for update;
 if not found or v_sub.status not in ('TRIALING','ACTIVE','PAST_DUE','CANCELED') or (v_sub.management_access_until is not null and v_sub.management_access_until < now()) then raise exception 'MANAGEMENT_ACCESS_REQUIRED'; end if;
 if v_sub.active_relationship_limit is not null and public.active_relationship_count(v_r.administration_id) >= v_sub.active_relationship_limit then raise exception 'RELATIONSHIP_CAPACITY_REACHED'; end if;
 if v_r.real_start_date is null or v_r.tracking_start_date is null or v_r.payment_day is null or v_r.payment_timing is null then raise exception 'RENTAL_TERMS_INCOMPLETE'; end if;
 if (select count(*) from public.rental_relationship_subjects s where s.rental_relationship_id=v_r.id and s.subject_role='PRIMARY')<>1 then raise exception 'PRIMARY_SUBJECT_REQUIRED'; end if;
 if (select count(*) from public.rental_participants p where p.rental_relationship_id=v_r.id and p.participation_type='TENANT' and p.status='ACTIVE')<>1 then raise exception 'ACTIVE_TENANT_REQUIRED'; end if;
 if (select count(*) from public.rental_participants p where p.rental_relationship_id=v_r.id and p.participation_type='LESSOR' and p.status='ACTIVE')<>1 then raise exception 'ACTIVE_LESSOR_REQUIRED'; end if;
 if not exists(select 1 from public.rental_term_versions t where t.rental_relationship_id=v_r.id and t.effective_from<=v_r.real_start_date and (t.effective_until is null or t.effective_until>=v_r.real_start_date)) then raise exception 'INITIAL_TERM_VERSION_REQUIRED'; end if;
 select person_id into lessor_id from public.rental_participants where rental_relationship_id=v_r.id and participation_type='LESSOR' and status='ACTIVE';
 for x in select rs.rental_subject_id,rs.administration_id,s.subject_type from public.rental_relationship_subjects rs join public.rental_subjects s on s.id=rs.rental_subject_id where rs.rental_relationship_id=v_r.id loop
   begin
     insert into public.rental_subject_occupancies(rental_subject_id,rental_relationship_id,administration_id) values(x.rental_subject_id,v_r.id,x.administration_id);
   exception when unique_violation then
     if x.subject_type<>'PARKING' then raise exception 'RENTAL_SUBJECT_ALREADY_IN_USE'; end if;
     select o.rental_relationship_id into existing_rel from public.rental_subject_occupancies o where o.rental_subject_id=x.rental_subject_id;
     select * into ar from public.asset_rights a where a.rental_subject_id=x.rental_subject_id and a.person_id=lessor_id and a.right_type='AUTHORIZED_SUBLEASE' and a.status='ACTIVE' and a.source_relationship_id=existing_rel and (a.valid_from is null or a.valid_from<=v_r.real_start_date) and (a.valid_until is null or a.valid_until>=v_r.real_start_date) order by a.created_at desc limit 1;
     if not found then raise exception 'RENTAL_SUBJECT_ALREADY_IN_USE'; end if;
     begin
       insert into public.rental_subject_sublease_occupancies(rental_subject_id,rental_relationship_id,source_relationship_id,administration_id,asset_right_id) values(x.rental_subject_id,v_r.id,existing_rel,x.administration_id,ar.id);
     exception when unique_violation then raise exception 'PARKING_ALREADY_SUBLEASED'; end;
   end;
 end loop;
 update public.rental_relationships set status='ACTIVE',activated_at=now() where id=v_r.id returning * into v_r; return v_r;
end $$;

create or replace function public.end_rental(p_relationship_id uuid,p_actual_end_date date default current_date)
returns public.rental_relationships language plpgsql security definer set search_path='' as $$
declare v_r public.rental_relationships; actor uuid; derived_ids uuid[];
begin
 select * into v_r from public.rental_relationships where id=p_relationship_id for update;
 if not found then raise exception 'RENTAL_NOT_FOUND'; end if;
 if public.has_administration_management_role(v_r.administration_id) is not true then raise exception 'ADMINISTRATION_ROLE_REQUIRED'; end if;
 if v_r.status not in('ACTIVE','ENDING') then raise exception 'RENTAL_NOT_ENDABLE'; end if;
 if p_actual_end_date<v_r.real_start_date then raise exception 'END_BEFORE_START'; end if;
 select array_agg(so.rental_relationship_id) into derived_ids from public.rental_subject_sublease_occupancies so join public.rental_relationships dr on dr.id=so.rental_relationship_id and dr.status in('ACTIVE','ENDING') where so.source_relationship_id=v_r.id;
 update public.rental_relationships set status='ENDED',actual_end_date=p_actual_end_date,ended_at=now() where id=v_r.id returning * into v_r;
 update public.rental_participants set status='ENDED',ends_on=coalesce(ends_on,p_actual_end_date) where rental_relationship_id=v_r.id and status='ACTIVE';
 delete from public.rental_subject_occupancies where rental_relationship_id=v_r.id;
 delete from public.rental_subject_sublease_occupancies where rental_relationship_id=v_r.id;
 if derived_ids is not null then
   select person_id into actor from public.accounts where auth_user_id=auth.uid();
   insert into public.audit_events(administration_id,rental_relationship_id,actor_person_id,action,entity_type,entity_id,metadata)
   values(v_r.administration_id,v_r.id,actor,'SOURCE_RELATIONSHIP_ENDED_WITH_ACTIVE_SUBLEASE','RENTAL_RELATIONSHIP',v_r.id,jsonb_build_object('derived_relationship_ids',to_jsonb(derived_ids),'review_required',true));
 end if;
 return v_r;
end $$;