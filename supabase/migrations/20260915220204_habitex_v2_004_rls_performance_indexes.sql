-- Optimize auth predicate initialization.
drop policy accounts_select_self on public.accounts;
create policy accounts_select_self on public.accounts for select to authenticated using(auth_user_id=(select auth.uid()));

-- Split ALL policies so SELECT does not duplicate the dedicated read policy.
drop policy room_space_access_write on public.room_space_access;
create policy room_space_access_insert on public.room_space_access for insert to authenticated with check(exists(select 1 from public.rooms r where r.id=room_id and public.can_manage_administration(r.administration_id)));
create policy room_space_access_update on public.room_space_access for update to authenticated using(exists(select 1 from public.rooms r where r.id=room_id and public.can_manage_administration(r.administration_id))) with check(exists(select 1 from public.rooms r where r.id=room_id and public.can_manage_administration(r.administration_id)));
create policy room_space_access_delete on public.room_space_access for delete to authenticated using(exists(select 1 from public.rooms r where r.id=room_id and public.can_manage_administration(r.administration_id)));

drop policy relationship_subjects_write on public.rental_relationship_subjects;
create policy relationship_subjects_insert on public.rental_relationship_subjects for insert to authenticated with check(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id)));
create policy relationship_subjects_update on public.rental_relationship_subjects for update to authenticated using(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id))) with check(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id)));
create policy relationship_subjects_delete on public.rental_relationship_subjects for delete to authenticated using(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id)));

drop policy rental_participants_write on public.rental_participants;
create policy rental_participants_insert on public.rental_participants for insert to authenticated with check(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id)));
create policy rental_participants_update on public.rental_participants for update to authenticated using(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id))) with check(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id)));
create policy rental_participants_delete on public.rental_participants for delete to authenticated using(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id)));

drop policy rental_terms_write on public.rental_term_versions;
create policy rental_terms_insert on public.rental_term_versions for insert to authenticated with check(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id)));
create policy rental_terms_update on public.rental_term_versions for update to authenticated using(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id))) with check(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id)));
create policy rental_terms_delete on public.rental_term_versions for delete to authenticated using(exists(select 1 from public.rental_relationships r where r.id=rental_relationship_id and r.status='DRAFT' and public.can_manage_administration(r.administration_id)));

-- Cover foreign keys flagged by the database advisor.
create index people_created_by_idx on public.people(created_by_person_id);
create index rooms_admin_property_idx on public.rooms(administration_id,property_id);
create index property_spaces_admin_property_idx on public.property_spaces(administration_id,property_id);
create index room_space_access_space_idx on public.room_space_access(property_space_id);
create index parkings_admin_property_idx on public.parkings(administration_id,property_id) where property_id is not null;
create index rental_subjects_admin_property_idx on public.rental_subjects(administration_id,property_id) where property_id is not null;
create index rental_subjects_admin_room_idx on public.rental_subjects(administration_id,room_id) where room_id is not null;
create index rental_subjects_admin_parking_idx on public.rental_subjects(administration_id,parking_id) where parking_id is not null;
create index relationship_subjects_admin_relationship_idx on public.rental_relationship_subjects(administration_id,rental_relationship_id);
create index relationship_subjects_admin_subject_idx on public.rental_relationship_subjects(administration_id,rental_subject_id);
create index asset_rights_admin_subject_idx on public.asset_rights(administration_id,rental_subject_id);
create index asset_rights_admin_source_relationship_idx on public.asset_rights(administration_id,source_relationship_id) where source_relationship_id is not null;
