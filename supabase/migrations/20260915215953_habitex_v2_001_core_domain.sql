create extension if not exists btree_gist with schema extensions;

create type public.account_status as enum ('ACTIVE','SUSPENDED');
create type public.administration_status as enum ('ACTIVE','SUSPENDED','ARCHIVED');
create type public.administration_role as enum ('OWNER','MANAGER','VIEWER');
create type public.member_status as enum ('ACTIVE','INACTIVE');
create type public.property_type as enum ('HOUSE','APARTMENT');
create type public.rental_mode as enum ('FULL_PROPERTY','BY_ROOMS');
create type public.bathroom_type as enum ('PRIVATE','SHARED');
create type public.vehicle_type as enum ('CAR','MOTORCYCLE','BOTH');
create type public.rental_subject_type as enum ('FULL_PROPERTY','ROOM','PARKING');
create type public.asset_right_type as enum ('OWNER','AUTHORIZED_ADMINISTRATOR','AUTHORIZED_SUBLEASE');
create type public.asset_right_status as enum ('PENDING','ACTIVE','REVOKED','EXPIRED','REJECTED');
create type public.rental_status as enum ('DRAFT','ACTIVE','ENDING','ENDED','CANCELLED');
create type public.payment_timing as enum ('ADVANCE','ARREARS');
create type public.relationship_subject_role as enum ('PRIMARY','INCLUDED');
create type public.rental_participation_type as enum ('LESSOR','TENANT','OCCUPANT');
create type public.participation_status as enum ('ACTIVE','ENDED');
create type public.administration_fee_mode as enum ('NONE','INCLUDED','TENANT_DIRECT');
create type public.utilities_responsibility as enum ('TENANT','LESSOR','SPECIAL_AGREEMENT');

create table public.people (
 id uuid primary key default gen_random_uuid(),
 full_name text not null check (length(trim(full_name)) > 0),
 nationality_country char(2), document_type text, document_number text, document_country char(2),
 email text, phone text, created_by_person_id uuid references public.people(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint people_document_complete check ((document_number is null and document_type is null and document_country is null) or (document_number is not null and document_type is not null and document_country is not null))
);
create unique index people_document_identity_uq on public.people (document_country, lower(document_type), lower(document_number)) where document_number is not null;
create index people_email_idx on public.people(lower(email)) where email is not null;

create table public.accounts (
 id uuid primary key default gen_random_uuid(), auth_user_id uuid not null unique references auth.users(id) on delete cascade,
 person_id uuid not null unique references public.people(id) on delete restrict,
 status public.account_status not null default 'ACTIVE', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.administrations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0),
 status public.administration_status not null default 'ACTIVE', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.administration_members (
 id uuid primary key default gen_random_uuid(), administration_id uuid not null references public.administrations(id) on delete cascade,
 person_id uuid not null references public.people(id) on delete cascade, role public.administration_role not null,
 status public.member_status not null default 'ACTIVE', created_at timestamptz not null default now(), unique(administration_id,person_id)
);
create index administration_members_person_idx on public.administration_members(person_id,status);

create table public.properties (
 id uuid primary key default gen_random_uuid(), administration_id uuid not null references public.administrations(id) on delete cascade,
 property_type public.property_type not null, rental_mode public.rental_mode not null, name text not null check(length(trim(name))>0),
 country_code char(2) not null default 'CO', city text not null check(length(trim(city))>0), address text not null check(length(trim(address))>0),
 has_administration boolean not null default false, administration_fee numeric(14,2),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(administration_id,id),
 constraint property_admin_fee_ck check ((not has_administration and administration_fee is null) or (has_administration and administration_fee is not null and administration_fee >= 0))
);
create index properties_admin_idx on public.properties(administration_id);

create table public.rooms (
 id uuid primary key default gen_random_uuid(), administration_id uuid not null references public.administrations(id) on delete cascade,
 property_id uuid not null, name text not null check(length(trim(name))>0), bathroom_type public.bathroom_type,
 furnished boolean not null default false, description text, is_enabled boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(administration_id,id), unique(property_id,name),
 foreign key(administration_id,property_id) references public.properties(administration_id,id) on delete cascade
);
create index rooms_admin_idx on public.rooms(administration_id);

create table public.property_spaces (
 id uuid primary key default gen_random_uuid(), administration_id uuid not null references public.administrations(id) on delete cascade,
 property_id uuid not null, space_type text not null, name text, description text, created_at timestamptz not null default now(),
 unique(administration_id,id), foreign key(administration_id,property_id) references public.properties(administration_id,id) on delete cascade
);

create table public.room_space_access (
 room_id uuid not null references public.rooms(id) on delete cascade, property_space_id uuid not null references public.property_spaces(id) on delete cascade,
 access_allowed boolean not null default true, primary key(room_id,property_space_id)
);

create table public.parkings (
 id uuid primary key default gen_random_uuid(), administration_id uuid not null references public.administrations(id) on delete cascade,
 property_id uuid, identifier text not null check(length(trim(identifier))>0), location text, covered boolean,
 allowed_vehicle_type public.vehicle_type, access_type text, observations text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(administration_id,id),
 foreign key(administration_id,property_id) references public.properties(administration_id,id) on delete set null
);
create index parkings_admin_idx on public.parkings(administration_id);

create table public.rental_subjects (
 id uuid primary key default gen_random_uuid(), administration_id uuid not null references public.administrations(id) on delete cascade,
 subject_type public.rental_subject_type not null, property_id uuid, room_id uuid, parking_id uuid, created_at timestamptz not null default now(),
 unique(administration_id,id),
 foreign key(administration_id,property_id) references public.properties(administration_id,id) on delete cascade,
 foreign key(administration_id,room_id) references public.rooms(administration_id,id) on delete cascade,
 foreign key(administration_id,parking_id) references public.parkings(administration_id,id) on delete cascade,
 constraint rental_subject_exactly_one_ck check(num_nonnulls(property_id,room_id,parking_id)=1),
 constraint rental_subject_type_target_ck check((subject_type='FULL_PROPERTY' and property_id is not null and room_id is null and parking_id is null) or (subject_type='ROOM' and room_id is not null and property_id is null and parking_id is null) or (subject_type='PARKING' and parking_id is not null and property_id is null and room_id is null))
);
create unique index rental_subject_property_uq on public.rental_subjects(property_id) where property_id is not null;
create unique index rental_subject_room_uq on public.rental_subjects(room_id) where room_id is not null;
create unique index rental_subject_parking_uq on public.rental_subjects(parking_id) where parking_id is not null;
create index rental_subjects_admin_idx on public.rental_subjects(administration_id);

create table public.rental_relationships (
 id uuid primary key default gen_random_uuid(), administration_id uuid not null references public.administrations(id) on delete cascade,
 status public.rental_status not null default 'DRAFT', jurisdiction_country char(2) not null default 'CO',
 real_start_date date, tracking_start_date date, expected_end_date date, actual_end_date date,
 payment_day smallint, payment_timing public.payment_timing,
 activated_at timestamptz, ending_started_at timestamptz, ended_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(administration_id,id),
 constraint rental_tracking_after_start_ck check(tracking_start_date is null or real_start_date is null or tracking_start_date>=real_start_date),
 constraint rental_payment_day_ck check(payment_day is null or payment_day between 1 and 31),
 constraint rental_actual_end_ck check(actual_end_date is null or real_start_date is null or actual_end_date>=real_start_date)
);
create index rental_relationships_admin_status_idx on public.rental_relationships(administration_id,status);

create table public.rental_relationship_subjects (
 id uuid primary key default gen_random_uuid(), administration_id uuid not null references public.administrations(id) on delete cascade,
 rental_relationship_id uuid not null, rental_subject_id uuid not null, subject_role public.relationship_subject_role not null,
 created_at timestamptz not null default now(), unique(rental_relationship_id,rental_subject_id),
 foreign key(administration_id,rental_relationship_id) references public.rental_relationships(administration_id,id) on delete cascade,
 foreign key(administration_id,rental_subject_id) references public.rental_subjects(administration_id,id) on delete restrict
);
create unique index rental_relationship_one_primary_uq on public.rental_relationship_subjects(rental_relationship_id) where subject_role='PRIMARY';
create index rental_relationship_subject_subject_idx on public.rental_relationship_subjects(rental_subject_id);

create table public.rental_participants (
 id uuid primary key default gen_random_uuid(), rental_relationship_id uuid not null references public.rental_relationships(id) on delete cascade,
 person_id uuid not null references public.people(id) on delete restrict, participation_type public.rental_participation_type not null,
 status public.participation_status not null default 'ACTIVE', starts_on date, ends_on date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint participant_dates_ck check(ends_on is null or starts_on is null or ends_on>=starts_on)
);
create index rental_participants_relationship_idx on public.rental_participants(rental_relationship_id,participation_type,status);
create index rental_participants_person_idx on public.rental_participants(person_id,status);
create unique index rental_one_active_tenant_uq on public.rental_participants(rental_relationship_id) where participation_type='TENANT' and status='ACTIVE';
create unique index rental_one_active_lessor_uq on public.rental_participants(rental_relationship_id) where participation_type='LESSOR' and status='ACTIVE';

create table public.rental_term_versions (
 id uuid primary key default gen_random_uuid(), rental_relationship_id uuid not null references public.rental_relationships(id) on delete cascade,
 version_number integer not null check(version_number>0), effective_from date not null, effective_until date,
 rent_amount numeric(14,2) not null check(rent_amount>=0), administration_mode public.administration_fee_mode not null default 'NONE',
 utilities_mode public.utilities_responsibility, special_terms jsonb,
 created_at timestamptz not null default now(), unique(rental_relationship_id,version_number),
 constraint rental_terms_dates_ck check(effective_until is null or effective_until>=effective_from),
 exclude using gist (rental_relationship_id with =, daterange(effective_from,coalesce(effective_until,'infinity'::date),'[]') with &&)
);

create table public.asset_rights (
 id uuid primary key default gen_random_uuid(), administration_id uuid not null references public.administrations(id) on delete cascade,
 rental_subject_id uuid not null, person_id uuid not null references public.people(id) on delete restrict,
 right_type public.asset_right_type not null, status public.asset_right_status not null default 'PENDING',
 source_relationship_id uuid, authorization_id uuid, valid_from date, valid_until date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(administration_id,rental_subject_id) references public.rental_subjects(administration_id,id) on delete cascade,
 foreign key(administration_id,source_relationship_id) references public.rental_relationships(administration_id,id) on delete restrict,
 constraint asset_right_dates_ck check(valid_until is null or valid_from is null or valid_until>=valid_from),
 constraint sublease_requires_source_ck check(right_type<>'AUTHORIZED_SUBLEASE' or source_relationship_id is not null)
);
create index asset_rights_subject_idx on public.asset_rights(rental_subject_id,status);
create index asset_rights_person_idx on public.asset_rights(person_id,status);

-- Fail closed immediately. Policies and controlled RPCs are migration 002.
alter table public.people enable row level security;
alter table public.accounts enable row level security;
alter table public.administrations enable row level security;
alter table public.administration_members enable row level security;
alter table public.properties enable row level security;
alter table public.rooms enable row level security;
alter table public.property_spaces enable row level security;
alter table public.room_space_access enable row level security;
alter table public.parkings enable row level security;
alter table public.rental_subjects enable row level security;
alter table public.rental_relationships enable row level security;
alter table public.rental_relationship_subjects enable row level security;
alter table public.rental_participants enable row level security;
alter table public.rental_term_versions enable row level security;
alter table public.asset_rights enable row level security;