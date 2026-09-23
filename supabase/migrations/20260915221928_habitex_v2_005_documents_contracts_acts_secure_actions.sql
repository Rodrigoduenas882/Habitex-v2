-- Habitex V2 documents/evidence layer.
create type public.file_purpose as enum ('CONTRACT_GENERATED','CONTRACT_SIGNED','ACT_PHOTO','ACT_ATTACHMENT','PAYMENT_PROOF','RECEIPT','AUTHORIZATION','OTHER');
create type public.contract_origin as enum ('HABITEX','EXTERNAL');
create type public.contract_status as enum ('DRAFT','GENERATED','SHARED','SIGNED','TERMINATED');
create type public.act_type as enum ('DELIVERY','RETURN');
create type public.act_status as enum ('DRAFT','READY_FOR_REVIEW','CONFIRMED','CLOSED');
create type public.secure_action_type as enum ('TENANT_INVITATION','DATA_CONFIRMATION','ACT_REVIEW','CONTRACT_REVIEW','PAYMENT_REPORT','SUBLEASE_AUTHORIZATION');
create type public.secure_action_status as enum ('PENDING','COMPLETED','EXPIRED','REVOKED');
create type public.acceptance_method as enum ('AUTHENTICATED_ACTION','SECURE_LINK','EXTERNAL_EVIDENCE','SYSTEM_IMPORT');

create table public.files (
 id uuid primary key default gen_random_uuid(),
 administration_id uuid not null references public.administrations(id) on delete cascade,
 rental_relationship_id uuid null references public.rental_relationships(id) on delete cascade,
 purpose public.file_purpose not null,
 storage_bucket text not null,
 storage_path text not null,
 original_name text null,
 mime_type text not null,
 size_bytes bigint not null check(size_bytes >= 0),
 sha256 text null check(sha256 is null or sha256 ~ '^[A-Fa-f0-9]{64}$'),
 uploaded_by_person_id uuid null references public.people(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(storage_bucket,storage_path)
);
create index files_admin_idx on public.files(administration_id);
create index files_relationship_idx on public.files(rental_relationship_id) where rental_relationship_id is not null;

create table public.contracts (
 id uuid primary key default gen_random_uuid(),
 administration_id uuid not null references public.administrations(id) on delete cascade,
 rental_relationship_id uuid not null references public.rental_relationships(id) on delete cascade,
 origin public.contract_origin not null,
 status public.contract_status not null,
 version_number integer not null default 1 check(version_number > 0),
 document_file_id uuid null references public.files(id) on delete restrict,
 signed_file_id uuid null references public.files(id) on delete restrict,
 terms_snapshot jsonb not null default '{}'::jsonb,
 document_hash text null check(document_hash is null or document_hash ~ '^[A-Fa-f0-9]{64}$'),
 generated_at timestamptz null,
 shared_at timestamptz null,
 signed_at timestamptz null,
 terminated_at timestamptz null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(rental_relationship_id,version_number),
 check((origin='EXTERNAL' and status in ('SIGNED','TERMINATED')) or origin='HABITEX'),
 check(origin<>'EXTERNAL' or signed_file_id is not null)
);
create index contracts_admin_relationship_idx on public.contracts(administration_id,rental_relationship_id);

create table public.acts (
 id uuid primary key default gen_random_uuid(),
 administration_id uuid not null references public.administrations(id) on delete cascade,
 rental_relationship_id uuid not null references public.rental_relationships(id) on delete cascade,
 act_type public.act_type not null,
 status public.act_status not null default 'DRAFT',
 version_number integer not null default 1 check(version_number > 0),
 general_observations text null,
 created_by_person_id uuid null references public.people(id) on delete set null,
 confirmed_at timestamptz null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(rental_relationship_id,act_type,version_number)
);
create index acts_admin_relationship_idx on public.acts(administration_id,rental_relationship_id);

create table public.act_items (
 id uuid primary key default gen_random_uuid(),
 act_id uuid not null references public.acts(id) on delete cascade,
 category text not null,
 item_name text not null,
 condition_text text null,
 observations text null,
 sort_order integer not null default 0,
 created_at timestamptz not null default now()
);
create index act_items_act_idx on public.act_items(act_id);

create table public.act_files (
 act_id uuid not null references public.acts(id) on delete cascade,
 file_id uuid not null references public.files(id) on delete restrict,
 caption text null,
 sort_order integer not null default 0,
 primary key(act_id,file_id)
);
create index act_files_file_idx on public.act_files(file_id);

create table public.act_observations (
 id uuid primary key default gen_random_uuid(),
 act_id uuid not null references public.acts(id) on delete cascade,
 person_id uuid not null references public.people(id) on delete restrict,
 observation text not null check(length(trim(observation))>0),
 created_at timestamptz not null default now()
);
create index act_observations_act_idx on public.act_observations(act_id);

create table public.secure_actions (
 id uuid primary key default gen_random_uuid(),
 administration_id uuid not null references public.administrations(id) on delete cascade,
 person_id uuid null references public.people(id) on delete set null,
 rental_relationship_id uuid null references public.rental_relationships(id) on delete cascade,
 action_type public.secure_action_type not null,
 status public.secure_action_status not null default 'PENDING',
 resource_type text null,
 resource_id uuid null,
 token_hash text not null unique check(token_hash ~ '^[A-Fa-f0-9]{64}$'),
 expires_at timestamptz not null,
 completed_at timestamptz null,
 revoked_at timestamptz null,
 created_by_person_id uuid null references public.people(id) on delete set null,
 created_at timestamptz not null default now(),
 check(expires_at > created_at)
);
create index secure_actions_admin_idx on public.secure_actions(administration_id);
create index secure_actions_relationship_idx on public.secure_actions(rental_relationship_id) where rental_relationship_id is not null;
create index secure_actions_pending_expiry_idx on public.secure_actions(expires_at) where status='PENDING';

create table public.acceptances (
 id uuid primary key default gen_random_uuid(),
 administration_id uuid null references public.administrations(id) on delete set null,
 person_id uuid not null references public.people(id) on delete restrict,
 rental_relationship_id uuid null references public.rental_relationships(id) on delete set null,
 document_type text not null,
 document_version text not null,
 purpose text not null,
 subject_type text null,
 subject_id uuid null,
 accepted_at timestamptz not null,
 method public.acceptance_method not null,
 evidence jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index acceptances_person_idx on public.acceptances(person_id);
create index acceptances_relationship_idx on public.acceptances(rental_relationship_id) where rental_relationship_id is not null;

create trigger contracts_updated_at before update on public.contracts for each row execute function public.set_updated_at();
create trigger acts_updated_at before update on public.acts for each row execute function public.set_updated_at();

-- Ensure relationship-owned documents stay in the same administration boundary.
create or replace function public.validate_document_administration() returns trigger language plpgsql set search_path='' as $$ begin
 if new.rental_relationship_id is not null and not exists(select 1 from public.rental_relationships r where r.id=new.rental_relationship_id and r.administration_id=new.administration_id) then raise exception 'RELATIONSHIP_ADMINISTRATION_MISMATCH'; end if;
 return new; end $$;
create trigger files_validate_admin before insert or update on public.files for each row execute function public.validate_document_administration();
create trigger contracts_validate_admin before insert or update on public.contracts for each row execute function public.validate_document_administration();
create trigger acts_validate_admin before insert or update on public.acts for each row execute function public.validate_document_administration();
create trigger secure_actions_validate_admin before insert or update on public.secure_actions for each row execute function public.validate_document_administration();

alter table public.files enable row level security;
alter table public.contracts enable row level security;
alter table public.acts enable row level security;
alter table public.act_items enable row level security;
alter table public.act_files enable row level security;
alter table public.act_observations enable row level security;
alter table public.secure_actions enable row level security;
alter table public.acceptances enable row level security;

create policy files_select on public.files for select to authenticated using(public.is_administration_member(administration_id) or (rental_relationship_id is not null and public.can_view_relationship(rental_relationship_id)));
create policy files_insert on public.files for insert to authenticated with check(public.can_manage_administration(administration_id) and (rental_relationship_id is null or public.can_view_relationship(rental_relationship_id)));
create policy files_delete on public.files for delete to authenticated using(public.can_manage_administration(administration_id));

create policy contracts_select on public.contracts for select to authenticated using(public.can_view_relationship(rental_relationship_id));
create policy contracts_insert on public.contracts for insert to authenticated with check(public.can_manage_administration(administration_id) and public.can_view_relationship(rental_relationship_id));
create policy contracts_update on public.contracts for update to authenticated using(public.can_manage_administration(administration_id) and status<>'TERMINATED') with check(public.can_manage_administration(administration_id));

create policy acts_select on public.acts for select to authenticated using(public.can_view_relationship(rental_relationship_id));
create policy acts_insert on public.acts for insert to authenticated with check(public.can_manage_administration(administration_id) and public.can_view_relationship(rental_relationship_id));
create policy acts_update on public.acts for update to authenticated using(public.can_manage_administration(administration_id) and status in ('DRAFT','READY_FOR_REVIEW')) with check(public.can_manage_administration(administration_id));

create policy act_items_select on public.act_items for select to authenticated using(exists(select 1 from public.acts a where a.id=act_id and public.can_view_relationship(a.rental_relationship_id)));
create policy act_items_write on public.act_items for all to authenticated using(exists(select 1 from public.acts a where a.id=act_id and a.status in ('DRAFT','READY_FOR_REVIEW') and public.can_manage_administration(a.administration_id))) with check(exists(select 1 from public.acts a where a.id=act_id and a.status in ('DRAFT','READY_FOR_REVIEW') and public.can_manage_administration(a.administration_id)));
create policy act_files_select on public.act_files for select to authenticated using(exists(select 1 from public.acts a where a.id=act_id and public.can_view_relationship(a.rental_relationship_id)));
create policy act_files_write on public.act_files for all to authenticated using(exists(select 1 from public.acts a where a.id=act_id and a.status in ('DRAFT','READY_FOR_REVIEW') and public.can_manage_administration(a.administration_id))) with check(exists(select 1 from public.acts a where a.id=act_id and a.status in ('DRAFT','READY_FOR_REVIEW') and public.can_manage_administration(a.administration_id)));
create policy act_observations_select on public.act_observations for select to authenticated using(exists(select 1 from public.acts a where a.id=act_id and public.can_view_relationship(a.rental_relationship_id)));
create policy act_observations_insert on public.act_observations for insert to authenticated with check(person_id=public.current_person_id() and exists(select 1 from public.acts a where a.id=act_id and public.can_view_relationship(a.rental_relationship_id)));

-- Secure action tokens are intentionally NOT readable from normal authenticated table access.
-- Creation/revocation belongs to managers; token consumption will use a narrow RPC later.
create policy secure_actions_insert on public.secure_actions for insert to authenticated with check(public.can_manage_administration(administration_id));
create policy secure_actions_update_manager on public.secure_actions for update to authenticated using(public.can_manage_administration(administration_id)) with check(public.can_manage_administration(administration_id));

create policy acceptances_select on public.acceptances for select to authenticated using(person_id=public.current_person_id() or (administration_id is not null and public.is_administration_member(administration_id)) or (rental_relationship_id is not null and public.can_view_relationship(rental_relationship_id)));
-- Acceptances are append-only. Authenticated self-acceptance can only be created for current person.
create policy acceptances_insert_self on public.acceptances for insert to authenticated with check(person_id=public.current_person_id() and (rental_relationship_id is null or public.can_view_relationship(rental_relationship_id)));
