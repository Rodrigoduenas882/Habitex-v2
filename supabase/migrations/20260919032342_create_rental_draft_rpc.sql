create or replace function public.create_rental_draft(
  p_administration_id uuid,
  p_rental_subject_id uuid,
  p_tenant_person_id uuid default null,
  p_tenant_full_name text default null,
  p_tenant_document_type text default null,
  p_tenant_document_number text default null,
  p_tenant_document_country character default null,
  p_tenant_nationality_country character default null,
  p_tenant_email text default null,
  p_tenant_phone text default null
)
returns table (
  rental_relationship_id uuid,
  tenant_person_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_person_id uuid;
  v_subject_exists boolean;
  v_tenant_accessible boolean;
  v_tenant_person public.people;
  v_tenant_person_id uuid;
  v_relationship_id uuid;
begin
  v_actor_person_id := public.current_person_id();
  if v_actor_person_id is null then
    raise exception 'create_rental_draft: no authenticated person for this session'
      using errcode = '28000';
  end if;

  if not public.can_manage_administration(p_administration_id) then
    raise exception 'create_rental_draft: caller cannot manage administration %', p_administration_id
      using errcode = '42501';
  end if;

  select true into v_subject_exists
  from public.rental_subjects rs
  where rs.id = p_rental_subject_id
    and rs.administration_id = p_administration_id
  for update;

  if v_subject_exists is null then
    raise exception 'create_rental_draft: rental subject % not found for administration %',
      p_rental_subject_id, p_administration_id
      using errcode = 'P0002';
  end if;

  if (p_tenant_person_id is not null) = (p_tenant_full_name is not null) then
    raise exception 'create_rental_draft: provide exactly one of p_tenant_person_id or p_tenant_full_name'
      using errcode = '22023';
  end if;

  if p_tenant_person_id is not null then
    select true into v_tenant_accessible
    from public.person_administration_links pal
    where pal.person_id = p_tenant_person_id
      and pal.administration_id = p_administration_id
    limit 1;

    if v_tenant_accessible is null then
      raise exception 'create_rental_draft: tenant person % is not usable by administration %',
        p_tenant_person_id, p_administration_id
        using errcode = '42501';
    end if;

    v_tenant_person_id := p_tenant_person_id;
  else
    v_tenant_person := public.create_tenant_person(
      p_administration_id => p_administration_id,
      p_full_name => p_tenant_full_name,
      p_document_type => p_tenant_document_type,
      p_document_number => p_tenant_document_number,
      p_document_country => p_tenant_document_country,
      p_nationality_country => p_tenant_nationality_country,
      p_email => p_tenant_email,
      p_phone => p_tenant_phone
    );

    v_tenant_person_id := v_tenant_person.id;
  end if;

  if v_tenant_person_id = v_actor_person_id then
    raise exception 'create_rental_draft: the lessor cannot also be the tenant of the same rental relationship'
      using errcode = '23514';
  end if;

  insert into public.rental_relationships (administration_id, status, jurisdiction_country)
  values (p_administration_id, 'DRAFT', 'CO')
  returning id into v_relationship_id;

  insert into public.rental_relationship_subjects (
    rental_relationship_id, rental_subject_id, subject_role, administration_id
  )
  values (v_relationship_id, p_rental_subject_id, 'PRIMARY', p_administration_id);

  insert into public.rental_participants (rental_relationship_id, person_id, participation_type, status)
  values
    (v_relationship_id, v_actor_person_id, 'LESSOR', 'ACTIVE'),
    (v_relationship_id, v_tenant_person_id, 'TENANT', 'ACTIVE');

  return query select v_relationship_id, v_tenant_person_id;
end;
$$;

revoke all on function public.create_rental_draft(
  uuid, uuid, uuid, text, text, text, character, character, text, text
) from public;

grant execute on function public.create_rental_draft(
  uuid, uuid, uuid, text, text, text, character, character, text, text
) to authenticated;