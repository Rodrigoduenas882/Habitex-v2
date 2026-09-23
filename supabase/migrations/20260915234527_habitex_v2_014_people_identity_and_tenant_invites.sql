drop index if exists public.people_document_identity_uq;
create index if not exists people_document_lookup_idx on public.people(document_country, lower(document_type), lower(document_number)) where document_number is not null;

create table public.person_administration_links (
 id uuid primary key default gen_random_uuid(),
 administration_id uuid not null references public.administrations(id) on delete cascade,
 person_id uuid not null references public.people(id) on delete cascade,
 relationship_type text not null check (relationship_type in ('TENANT','CONTACT')),
 created_by_person_id uuid references public.people(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(administration_id,person_id,relationship_type)
);
create index person_administration_links_person_idx on public.person_administration_links(person_id);
alter table public.person_administration_links enable row level security;
grant select on public.person_administration_links to authenticated;
revoke insert,update,delete on public.person_administration_links from anon,authenticated;
create policy person_administration_links_select on public.person_administration_links for select to authenticated using (public.is_administration_member(administration_id) or person_id=public.current_person_id());

create or replace function public.create_tenant_person(
 p_administration_id uuid,
 p_full_name text,
 p_document_type text default null,
 p_document_number text default null,
 p_document_country char(2) default 'CO',
 p_nationality_country char(2) default null,
 p_email text default null,
 p_phone text default null
) returns public.people language plpgsql security definer set search_path=''
as $$
declare v_actor uuid; v_person public.people;
begin
 if public.can_manage_administration(p_administration_id) is not true then raise exception 'MANAGEMENT_ACCESS_REQUIRED'; end if;
 v_actor:=public.current_person_id();
 if nullif(btrim(p_full_name),'') is null then raise exception 'FULL_NAME_REQUIRED'; end if;
 if p_document_number is not null and nullif(btrim(coalesce(p_document_type,'')),'') is null then raise exception 'DOCUMENT_TYPE_REQUIRED'; end if;
 if p_document_number is not null and p_document_country is null then raise exception 'DOCUMENT_COUNTRY_REQUIRED'; end if;
 insert into public.people(full_name,nationality_country,document_type,document_number,document_country,email,phone,created_by_person_id)
 values(btrim(p_full_name),p_nationality_country,nullif(btrim(p_document_type),''),nullif(btrim(p_document_number),''),case when nullif(btrim(p_document_number),'') is null then null else p_document_country end,nullif(lower(btrim(p_email)),''),nullif(btrim(p_phone),''),v_actor)
 returning * into v_person;
 insert into public.person_administration_links(administration_id,person_id,relationship_type,created_by_person_id) values(p_administration_id,v_person.id,'TENANT',v_actor);
 return v_person;
end $$;

create or replace function public.create_tenant_invitation(
 p_administration_id uuid,
 p_person_id uuid,
 p_rental_relationship_id uuid,
 p_token_hash text,
 p_expires_at timestamptz
) returns public.secure_actions language plpgsql security definer set search_path=''
as $$
declare v_actor uuid; v_action public.secure_actions;
begin
 if public.can_manage_administration(p_administration_id) is not true then raise exception 'MANAGEMENT_ACCESS_REQUIRED'; end if;
 v_actor:=public.current_person_id();
 if p_expires_at<=now() then raise exception 'EXPIRY_MUST_BE_FUTURE'; end if;
 if p_token_hash !~ '^[0-9a-fA-F]{64}$' then raise exception 'INVALID_TOKEN_HASH'; end if;
 if not exists(select 1 from public.person_administration_links l where l.administration_id=p_administration_id and l.person_id=p_person_id and l.relationship_type='TENANT') then raise exception 'TENANT_NOT_IN_ADMINISTRATION'; end if;
 if p_rental_relationship_id is not null and not exists(select 1 from public.rental_relationships r where r.id=p_rental_relationship_id and r.administration_id=p_administration_id) then raise exception 'RENTAL_ADMINISTRATION_MISMATCH'; end if;
 insert into public.secure_actions(administration_id,person_id,rental_relationship_id,action_type,resource_type,resource_id,token_hash,expires_at,created_by_person_id)
 values(p_administration_id,p_person_id,p_rental_relationship_id,'TENANT_INVITATION','PERSON',p_person_id,lower(p_token_hash),p_expires_at,v_actor)
 returning * into v_action;
 return v_action;
end $$;

revoke all on function public.create_tenant_person(uuid,text,text,text,char(2),char(2),text,text) from public,anon;
grant execute on function public.create_tenant_person(uuid,text,text,text,char(2),char(2),text,text) to authenticated,service_role;
revoke all on function public.create_tenant_invitation(uuid,uuid,uuid,text,timestamptz) from public,anon;
grant execute on function public.create_tenant_invitation(uuid,uuid,uuid,text,timestamptz) to authenticated,service_role;