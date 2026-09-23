-- Habitex V2 security helpers and controlled core operations.

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;

do $$ declare t text; begin foreach t in array array['people','accounts','administrations','properties','rooms','parkings','rental_relationships','rental_participants','asset_rights'] loop execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()',t,t); end loop; end $$;

create or replace function public.current_person_id() returns uuid language sql stable security definer set search_path='' as $$ select a.person_id from public.accounts a where a.auth_user_id=auth.uid() and a.status='ACTIVE' limit 1 $$;
revoke all on function public.current_person_id() from public;
grant execute on function public.current_person_id() to authenticated;

create or replace function public.is_administration_member(p_administration_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.administration_members m where m.administration_id=p_administration_id and m.person_id=public.current_person_id() and m.status='ACTIVE') $$;
revoke all on function public.is_administration_member(uuid) from public;
grant execute on function public.is_administration_member(uuid) to authenticated;

create or replace function public.can_manage_administration(p_administration_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.administration_members m where m.administration_id=p_administration_id and m.person_id=public.current_person_id() and m.status='ACTIVE' and m.role in ('OWNER','MANAGER')) $$;
revoke all on function public.can_manage_administration(uuid) from public;
grant execute on function public.can_manage_administration(uuid) to authenticated;

create or replace function public.can_view_relationship(p_relationship_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.rental_relationships r where r.id=p_relationship_id and (public.is_administration_member(r.administration_id) or exists(select 1 from public.rental_participants rp where rp.rental_relationship_id=r.id and rp.person_id=public.current_person_id()))) $$;
revoke all on function public.can_view_relationship(uuid) from public;
grant execute on function public.can_view_relationship(uuid) to authenticated;

-- Bootstrap is the only authenticated path that creates the user's Person/Account/first Administration.
create or replace function public.bootstrap_account(p_full_name text, p_administration_name text default 'Mi administración') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_auth uuid:=auth.uid(); v_person uuid; v_account uuid; v_admin uuid;
begin
 if v_auth is null then raise exception 'AUTH_REQUIRED'; end if;
 if nullif(trim(p_full_name),'') is null then raise exception 'FULL_NAME_REQUIRED'; end if;
 select a.person_id,a.id into v_person,v_account from public.accounts a where a.auth_user_id=v_auth;
 if v_account is not null then
   select m.administration_id into v_admin from public.administration_members m where m.person_id=v_person and m.status='ACTIVE' order by m.created_at limit 1;
   return jsonb_build_object('person_id',v_person,'account_id',v_account,'administration_id',v_admin,'created',false);
 end if;
 insert into public.people(full_name,email) select trim(p_full_name),u.email from auth.users u where u.id=v_auth returning id into v_person;
 insert into public.accounts(auth_user_id,person_id) values(v_auth,v_person) returning id into v_account;
 insert into public.administrations(name) values(coalesce(nullif(trim(p_administration_name),''),'Mi administración')) returning id into v_admin;
 insert into public.administration_members(administration_id,person_id,role) values(v_admin,v_person,'OWNER');
 return jsonb_build_object('person_id',v_person,'account_id',v_account,'administration_id',v_admin,'created',true);
end $$;
revoke all on function public.bootstrap_account(text,text) from public;
grant execute on function public.bootstrap_account(text,text) to authenticated;

-- Validate physical/rental modality at DB boundary.
create or replace function public.validate_room_property_mode() returns trigger language plpgsql set search_path='' as $$ begin if not exists(select 1 from public.properties p where p.id=new.property_id and p.administration_id=new.administration_id and p.rental_mode='BY_ROOMS') then raise exception 'ROOM_REQUIRES_BY_ROOMS_PROPERTY'; end if; return new; end $$;
create trigger rooms_validate_property_mode before insert or update of property_id,administration_id on public.rooms for each row execute function public.validate_room_property_mode();

create or replace function public.validate_rental_subject() returns trigger language plpgsql set search_path='' as $$ begin
 if new.subject_type='FULL_PROPERTY' and not exists(select 1 from public.properties p where p.id=new.property_id and p.rental_mode='FULL_PROPERTY') then raise exception 'FULL_PROPERTY_SUBJECT_REQUIRES_FULL_PROPERTY_MODE'; end if;
 if new.subject_type='ROOM' and not exists(select 1 from public.rooms r join public.properties p on p.id=r.property_id where r.id=new.room_id and p.rental_mode='BY_ROOMS') then raise exception 'ROOM_SUBJECT_REQUIRES_BY_ROOMS_MODE'; end if;
 return new; end $$;
create trigger rental_subjects_validate before insert or update on public.rental_subjects for each row execute function public.validate_rental_subject();

-- Activation is atomic and checks minimum domain invariants plus exclusive occupancy.
create or replace function public.activate_rental_relationship(p_relationship_id uuid) returns public.rental_relationships
language plpgsql security definer set search_path='' as $$
declare v_r public.rental_relationships; v_conflict boolean;
begin
 select * into v_r from public.rental_relationships where id=p_relationship_id for update;
 if not found then raise exception 'RENTAL_NOT_FOUND'; end if;
 if not public.can_manage_administration(v_r.administration_id) then raise exception 'FORBIDDEN'; end if;
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
revoke all on function public.activate_rental_relationship(uuid) from public;
grant execute on function public.activate_rental_relationship(uuid) to authenticated;

-- Account/person self access.
create policy accounts_select_self on public.accounts for select to authenticated using(auth_user_id=auth.uid());
create policy people_select_visible on public.people for select to authenticated using(id=public.current_person_id() or exists(select 1 from public.rental_participants rp join public.rental_relationships rr on rr.id=rp.rental_relationship_id where rp.person_id=people.id and public.is_administration_member(rr.administration_id)));
create policy people_update_self on public.people for update to authenticated using(id=public.current_person_id()) with check(id=public.current_person_id());

-- Administration membership visibility.
create policy administrations_select_member on public.administrations for select to authenticated using(public.is_administration_member(id));
create policy administrations_update_manager on public.administrations for update to authenticated using(public.can_manage_administration(id)) with check(public.can_manage_administration(id));
create policy administration_members_select_member on public.administration_members for select to authenticated using(public.is_administration_member(administration_id));

-- Administrative resources: members read; OWNER/MANAGER write.
create policy properties_select on public.properties for select to authenticated using(public.is_administration_member(administration_id));
create policy properties_insert on public.properties for insert to authenticated with check(public.can_manage_administration(administration_id));
create policy properties_update on public.properties for update to authenticated using(public.can_manage_administration(administration_id)) with check(public.can_manage_administration(administration_id));
create policy properties_delete on public.properties for delete to authenticated using(public.can_manage_administration(administration_id));
create policy rooms_select on public.rooms for select to authenticated using(public.is_administration_member(administration_id));
create policy rooms_insert on public.rooms for insert to authenticated with check(public.can_manage_administration(administration_id));
create policy rooms_update on public.rooms for update to authenticated using(public.can_manage_administration(administration_id)) with check(public.can_manage_administration(administration_id));
create policy rooms_delete on public.rooms for delete to authenticated using(public.can_manage_administration(administration_id));
create policy property_spaces_select on public.property_spaces for select to authenticated using(public.is_administration_member(administration_id));
create policy property_spaces_insert on public.property_spaces for insert to authenticated with check(public.can_manage_administration(administration_id));
create policy property_spaces_update on public.property_spaces for update to authenticated using(public.can_manage_administration(administration_id)) with check(public.can_manage_administration(administration_id));
create policy property_spaces_delete on public.property_spaces for delete to authenticated using(public.can_manage_administration(administration_id));
create policy room_space_access_select on public.room_space_access for select to authenticated using(exists(select 1 from public.rooms r where r.id=room_id and public.is_administration_member(r.administration_id)));
create policy room_space_access_write on public.room_space_access for all to authenticated using(exists(select 1 from public.rooms r where r.id=room_id and public.can_manage_administration(r.administration_id))) with check(exists(select 1 from public.rooms r where r.id=room_id and public.can_manage_administration(r.administration_id)));
create policy parkings_select on public.parkings for select to authenticated using(public.is_administration_member(administration_id));
create policy parkings_insert on public.parkings for insert to authenticated with check(public.can_manage_administration(administration_id));
create policy parkings_update on public.parkings for update to authenticated using(public.can_manage_administration(administration_id)) with check(public.can_manage_administration(administration_id));
create policy parkings_delete on public.parkings for delete to authenticated using(public.can_manage_administration(administration_id));
create policy rental_subjects_select on public.rental_subjects for select to authenticated using(public.is_administration_member(administration_id));
create policy rental_subjects_insert on public.rental_subjects for insert to authenticated with check(public.can_manage_administration(administration_id));
create policy rental_subjects_update on public.rental_subjects for update to authenticated using(public.can_manage_administration(administration_id)) with check(public.can_manage_administration(administration_id));
create policy rental_subjects_delete on public.rental_subjects for delete to authenticated using(public.can_manage_administration(administration_id));
create policy asset_rights_select on public.asset_rights for select to authenticated using(public.is_administration_member(administration_id) or person_id=public.current_person_id());
create policy asset_rights_insert on public.asset_rights for insert to authenticated with check(public.can_manage_administration(administration_id));
create policy asset_rights_update on public.asset_rights for update to authenticated using(public.can_manage_administration(administration_id)) with check(public.can_manage_administration(administration_id));

-- Rental data: administration members and relationship participants can read; managers write drafts/core data.
create policy rental_relationships_select on public.rental_relationships for select to authenticated using(public.is_administration_member(administration_id) or exists(select 1 from public.rental_participants rp where rp.rental_relationship_id=id and rp.person_id=public.current_person_id()));
create policy rental_relationships_insert on public.rental_relationships for insert to authenticated with check(public.can_manage_administration(administration_id) and status='DRAFT');
create policy rental_relationships_update_draft on public.rental_relationships for update to authenticated using(public.can_manage_administration(administration_id) and status='DRAFT') with check(public.can_manage_administration(administration_id) and status='DRAFT');
create policy relationship_subjects_select on public.rental_relationship_subjects for select to authenticated using(public.can_view_relationship(rental_relationship_id));
create policy relationship_subjects_write on public.rental_relationship_subjects for all to authenticated using(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id))) with check(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id)));
create policy rental_participants_select on public.rental_participants for select to authenticated using(public.can_view_relationship(rental_relationship_id));
create policy rental_participants_write on public.rental_participants for all to authenticated using(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id))) with check(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id)));
create policy rental_terms_select on public.rental_term_versions for select to authenticated using(public.can_view_relationship(rental_relationship_id));
create policy rental_terms_write on public.rental_term_versions for all to authenticated using(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id))) with check(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id)));
