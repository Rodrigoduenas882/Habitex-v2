-- Lifecycle operations and audit hardening.
-- Relationship visibility helper remains internal and explicit.
create or replace function public.can_view_relationship(p_relationship_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(
   select 1 from public.rental_relationships r
   where r.id=p_relationship_id
     and (
       public.is_administration_member(r.administration_id)
       or exists(select 1 from public.rental_participants rp where rp.rental_relationship_id=p_relationship_id and rp.person_id=public.current_person_id())
     )
 )
$$;
revoke all on function public.can_view_relationship(uuid) from public,anon,authenticated;

create or replace function public.start_ending_rental(p_relationship_id uuid) returns public.rental_relationships language plpgsql security definer set search_path='' as $$
declare v_r public.rental_relationships;
begin
 select * into v_r from public.rental_relationships where id=p_relationship_id for update;
 if not found then raise exception 'RENTAL_NOT_FOUND'; end if;
 if not public.can_manage_administration(v_r.administration_id) then raise exception 'MANAGEMENT_ACCESS_REQUIRED'; end if;
 if v_r.status<>'ACTIVE' then raise exception 'RENTAL_NOT_ACTIVE'; end if;
 update public.rental_relationships set status='ENDING',ending_started_at=now() where id=v_r.id returning * into v_r;
 return v_r;
end $$;
revoke all on function public.start_ending_rental(uuid) from public,anon;
grant execute on function public.start_ending_rental(uuid) to authenticated;

create or replace function public.end_rental(p_relationship_id uuid,p_actual_end_date date default current_date) returns public.rental_relationships language plpgsql security definer set search_path='' as $$
declare v_r public.rental_relationships;
begin
 select * into v_r from public.rental_relationships where id=p_relationship_id for update;
 if not found then raise exception 'RENTAL_NOT_FOUND'; end if;
 if not public.can_manage_administration(v_r.administration_id) then raise exception 'MANAGEMENT_ACCESS_REQUIRED'; end if;
 if v_r.status not in ('ACTIVE','ENDING') then raise exception 'RENTAL_NOT_ENDABLE'; end if;
 if p_actual_end_date < v_r.real_start_date then raise exception 'END_BEFORE_START'; end if;
 update public.rental_relationships set status='ENDED',actual_end_date=p_actual_end_date,ended_at=now() where id=v_r.id returning * into v_r;
 update public.rental_participants set status='ENDED',ends_on=coalesce(ends_on,p_actual_end_date) where rental_relationship_id=v_r.id and status='ACTIVE';
 return v_r;
end $$;
revoke all on function public.end_rental(uuid,date) from public,anon;
grant execute on function public.end_rental(uuid,date) to authenticated;

create or replace function public.cancel_draft_rental(p_relationship_id uuid) returns public.rental_relationships language plpgsql security definer set search_path='' as $$
declare v_r public.rental_relationships;
begin
 select * into v_r from public.rental_relationships where id=p_relationship_id for update;
 if not found then raise exception 'RENTAL_NOT_FOUND'; end if;
 if not public.can_manage_administration(v_r.administration_id) then raise exception 'MANAGEMENT_ACCESS_REQUIRED'; end if;
 if v_r.status<>'DRAFT' then raise exception 'ONLY_DRAFT_CAN_BE_CANCELLED'; end if;
 update public.rental_relationships set status='CANCELLED' where id=v_r.id returning * into v_r;
 return v_r;
end $$;
revoke all on function public.cancel_draft_rental(uuid) from public,anon;
grant execute on function public.cancel_draft_rental(uuid) to authenticated;

-- Browser cannot mutate relationship lifecycle directly. Draft field editing stays allowed but status cannot change.
drop policy if exists rental_relationships_update_draft on public.rental_relationships;
create policy rental_relationships_update_draft on public.rental_relationships for update to authenticated
 using(public.can_manage_administration(administration_id) and status='DRAFT')
 with check(public.can_manage_administration(administration_id) and status='DRAFT');

-- Audit rows must never block the domain operation if an actor has no Habitex account (e.g. trusted backend/webhook).
create or replace function public.audit_domain_row_change() returns trigger language plpgsql security definer set search_path='' as $$
declare v_row jsonb; v_old jsonb; v_admin uuid; v_rel uuid; v_id uuid; v_actor uuid; v_meta jsonb;
begin
 v_row:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 v_old:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
 v_admin:=nullif(v_row->>'administration_id','')::uuid;
 v_rel:=nullif(v_row->>'rental_relationship_id','')::uuid;
 if v_rel is null and tg_table_name='rental_relationships' then v_rel:=nullif(v_row->>'id','')::uuid; end if;
 v_id:=nullif(v_row->>'id','')::uuid;
 select a.person_id into v_actor from public.accounts a where a.auth_user_id=auth.uid() and a.status='ACTIVE' limit 1;
 v_meta:=jsonb_strip_nulls(jsonb_build_object('operation',tg_op,'old_status',v_old->>'status','new_status',v_row->>'status'));
 insert into public.audit_events(administration_id,rental_relationship_id,actor_person_id,action,entity_type,entity_id,metadata)
 values(v_admin,v_rel,v_actor,tg_op,tg_table_name,v_id,v_meta);
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function public.audit_domain_row_change() from public,anon,authenticated;

-- Cover FK columns introduced in migration 008.
create index administration_subscriptions_admin_idx on public.administration_subscriptions(administration_id);
create index communication_events_created_by_idx on public.communication_events(created_by_person_id) where created_by_person_id is not null;
create index audit_events_admin_fk_idx on public.audit_events(administration_id) where administration_id is not null;
