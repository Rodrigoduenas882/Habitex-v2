create or replace function public.confirm_act(p_act_id uuid)
returns public.acts
language plpgsql
security definer
set search_path=''
as $function$
declare
  a public.acts;
  person uuid;
  has_tenant_confirmation boolean;
  has_lessor_confirmation boolean;
begin
  select * into a from public.acts where id=p_act_id for update;
  if not found then raise exception 'ACT_NOT_FOUND'; end if;
  if a.status<>'READY_FOR_REVIEW' then raise exception 'ACT_NOT_READY'; end if;

  select person_id into person from public.accounts where auth_user_id=auth.uid();
  if person is null or not exists(
    select 1 from public.rental_participants rp
    where rp.rental_relationship_id=a.rental_relationship_id
      and rp.person_id=person
      and rp.status='ACTIVE'
      and rp.participation_type in('TENANT','LESSOR')
  ) then raise exception 'ACT_CONFIRMATION_NOT_ALLOWED'; end if;

  if exists(select 1 from public.acceptances x where x.person_id=person and x.subject_type='ACT' and x.subject_id=a.id)
  then raise exception 'ACT_ALREADY_CONFIRMED_BY_PERSON'; end if;

  insert into public.acceptances(administration_id,person_id,rental_relationship_id,document_type,document_version,purpose,subject_type,subject_id,accepted_at,method,evidence)
  values(a.administration_id,person,a.rental_relationship_id,'ACT',a.version_number::text,'CONFIRM_ACT','ACT',a.id,now(),'AUTHENTICATED_ACTION',jsonb_build_object('act_type',a.act_type::text));

  select
    exists(
      select 1 from public.acceptances x
      join public.rental_participants rp on rp.person_id=x.person_id and rp.rental_relationship_id=a.rental_relationship_id
      where x.subject_type='ACT' and x.subject_id=a.id and rp.status='ACTIVE' and rp.participation_type='TENANT'
    ),
    exists(
      select 1 from public.acceptances x
      join public.rental_participants rp on rp.person_id=x.person_id and rp.rental_relationship_id=a.rental_relationship_id
      where x.subject_type='ACT' and x.subject_id=a.id and rp.status='ACTIVE' and rp.participation_type='LESSOR'
    )
  into has_tenant_confirmation, has_lessor_confirmation;

  if has_tenant_confirmation and has_lessor_confirmation then
    update public.acts set status='CONFIRMED',confirmed_at=now(),updated_at=now() where id=a.id returning * into a;
  end if;
  return a;
end
$function$;

create or replace function public.issue_relationship_clearance(p_relationship_id uuid)
returns public.relationship_clearances
language plpgsql
security definer
set search_path=''
as $function$
declare
  r public.rental_relationships;
  c public.relationship_clearances;
  actor uuid;
begin
  select * into r from public.rental_relationships where id=p_relationship_id for update;
  if not found then raise exception 'RENTAL_RELATIONSHIP_NOT_FOUND'; end if;
  if public.can_manage_administration(r.administration_id) is not true then raise exception 'MANAGEMENT_ACCESS_REQUIRED'; end if;
  if r.status<>'ENDED' then raise exception 'RELATIONSHIP_MUST_BE_ENDED'; end if;
  if exists(select 1 from public.charge_balances b where b.rental_relationship_id=r.id and b.balance>0) then raise exception 'OUTSTANDING_HABITEX_BALANCE'; end if;

  select * into c from public.relationship_clearances
  where rental_relationship_id=r.id and status='ISSUED'
  order by issued_at desc limit 1;
  if found then return c; end if;

  select person_id into actor from public.accounts where auth_user_id=auth.uid();
  insert into public.relationship_clearances(administration_id,rental_relationship_id,status,issued_at,issued_by_person_id)
  values(r.administration_id,r.id,'ISSUED',now(),actor)
  returning * into c;
  return c;
end
$function$;