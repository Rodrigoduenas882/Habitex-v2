create or replace function public.claim_tenant_invitation(p_token text)
returns public.people
language plpgsql
security definer
set search_path=''
as $$
declare
 v_hash text;
 v_action public.secure_actions;
 v_existing_account public.accounts;
 v_person public.people;
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if nullif(btrim(p_token),'') is null then raise exception 'TOKEN_REQUIRED'; end if;
 v_hash:=encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex');

 select * into v_action
 from public.secure_actions
 where token_hash=v_hash and action_type='TENANT_INVITATION'
 for update;
 if not found then raise exception 'INVITATION_NOT_FOUND'; end if;
 if v_action.status<>'PENDING' then raise exception 'INVITATION_NOT_PENDING'; end if;
 if v_action.revoked_at is not null then raise exception 'INVITATION_REVOKED'; end if;
 if v_action.expires_at<=now() then
   update public.secure_actions set status='EXPIRED' where id=v_action.id;
   raise exception 'INVITATION_EXPIRED';
 end if;
 if v_action.person_id is null then raise exception 'INVITATION_PERSON_REQUIRED'; end if;

 select * into v_existing_account from public.accounts where auth_user_id=auth.uid() for update;
 if found and v_existing_account.person_id<>v_action.person_id then raise exception 'ACCOUNT_ALREADY_LINKED_TO_ANOTHER_PERSON'; end if;

 if not found then
   if exists(select 1 from public.accounts where person_id=v_action.person_id) then raise exception 'PERSON_ALREADY_LINKED_TO_ANOTHER_ACCOUNT'; end if;
   insert into public.accounts(auth_user_id,person_id,status) values(auth.uid(),v_action.person_id,'ACTIVE');
 end if;

 update public.secure_actions set status='COMPLETED',completed_at=now() where id=v_action.id;
 insert into public.acceptances(administration_id,person_id,rental_relationship_id,document_type,document_version,purpose,subject_type,subject_id,accepted_at,method,evidence)
 values(v_action.administration_id,v_action.person_id,v_action.rental_relationship_id,'TENANT_INVITATION','1','CLAIM_PERSON_IDENTITY','PERSON',v_action.person_id,now(),'AUTHENTICATED_ACTION',jsonb_build_object('secure_action_id',v_action.id,'auth_user_id',auth.uid()));
 select * into v_person from public.people where id=v_action.person_id;
 return v_person;
end $$;

revoke all on function public.claim_tenant_invitation(text) from public,anon;
grant execute on function public.claim_tenant_invitation(text) to authenticated,service_role;