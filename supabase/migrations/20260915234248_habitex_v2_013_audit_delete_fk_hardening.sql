create or replace function public.audit_domain_row_change()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_row jsonb; v_old jsonb; v_admin uuid; v_rel uuid; v_id uuid; v_actor uuid; v_meta jsonb;
begin
 v_row:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 v_old:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
 v_admin:=nullif(v_row->>'administration_id','')::uuid;
 v_rel:=nullif(v_row->>'rental_relationship_id','')::uuid;
 if v_rel is null and tg_table_name='rental_relationships' then v_rel:=nullif(v_row->>'id','')::uuid; end if;
 v_id:=nullif(v_row->>'id','')::uuid;
 select a.person_id into v_actor from public.accounts a where a.auth_user_id=auth.uid() and a.status='ACTIVE' limit 1;
 v_meta:=jsonb_strip_nulls(jsonb_build_object('operation',tg_op,'old_status',v_old->>'status','new_status',v_row->>'status','relationship_id',v_rel));
 if tg_op='DELETE' and tg_table_name='rental_relationships' then v_rel:=null; end if;
 insert into public.audit_events(administration_id,rental_relationship_id,actor_person_id,action,entity_type,entity_id,metadata)
 values(v_admin,v_rel,v_actor,tg_op,tg_table_name,v_id,v_meta);
 return case when tg_op='DELETE' then old else new end;
end $$;