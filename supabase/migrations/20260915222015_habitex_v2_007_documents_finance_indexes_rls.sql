-- Split broad act write policies to avoid duplicate SELECT policies.
drop policy act_items_write on public.act_items;
create policy act_items_insert on public.act_items for insert to authenticated with check(exists(select 1 from public.acts a where a.id=act_id and a.status in ('DRAFT','READY_FOR_REVIEW') and public.can_manage_administration(a.administration_id)));
create policy act_items_update on public.act_items for update to authenticated using(exists(select 1 from public.acts a where a.id=act_id and a.status in ('DRAFT','READY_FOR_REVIEW') and public.can_manage_administration(a.administration_id))) with check(exists(select 1 from public.acts a where a.id=act_id and a.status in ('DRAFT','READY_FOR_REVIEW') and public.can_manage_administration(a.administration_id)));
create policy act_items_delete on public.act_items for delete to authenticated using(exists(select 1 from public.acts a where a.id=act_id and a.status in ('DRAFT','READY_FOR_REVIEW') and public.can_manage_administration(a.administration_id)));

drop policy act_files_write on public.act_files;
create policy act_files_insert on public.act_files for insert to authenticated with check(exists(select 1 from public.acts a where a.id=act_id and a.status in ('DRAFT','READY_FOR_REVIEW') and public.can_manage_administration(a.administration_id)));
create policy act_files_update on public.act_files for update to authenticated using(exists(select 1 from public.acts a where a.id=act_id and a.status in ('DRAFT','READY_FOR_REVIEW') and public.can_manage_administration(a.administration_id))) with check(exists(select 1 from public.acts a where a.id=act_id and a.status in ('DRAFT','READY_FOR_REVIEW') and public.can_manage_administration(a.administration_id)));
create policy act_files_delete on public.act_files for delete to authenticated using(exists(select 1 from public.acts a where a.id=act_id and a.status in ('DRAFT','READY_FOR_REVIEW') and public.can_manage_administration(a.administration_id)));

-- Cover new foreign keys flagged by advisors.
create index acceptances_admin_idx on public.acceptances(administration_id) where administration_id is not null;
create index act_observations_person_idx on public.act_observations(person_id);
create index acts_created_by_idx on public.acts(created_by_person_id) where created_by_person_id is not null;
create index contracts_document_file_idx on public.contracts(document_file_id) where document_file_id is not null;
create index contracts_signed_file_idx on public.contracts(signed_file_id) where signed_file_id is not null;
create index files_uploaded_by_idx on public.files(uploaded_by_person_id) where uploaded_by_person_id is not null;
create index secure_actions_person_idx on public.secure_actions(person_id) where person_id is not null;
create index secure_actions_created_by_idx on public.secure_actions(created_by_person_id) where created_by_person_id is not null;
create index payment_allocations_admin_idx on public.payment_allocations(administration_id);
create index payments_reported_by_idx on public.payments(reported_by_person_id) where reported_by_person_id is not null;
create index payments_confirmed_by_idx on public.payments(confirmed_by_person_id) where confirmed_by_person_id is not null;
create index payments_proof_file_idx on public.payments(proof_file_id) where proof_file_id is not null;
create index receipts_file_idx on public.receipts(file_id) where file_id is not null;
