-- RLS policy expressions execute as the authenticated caller and therefore need EXECUTE on helper functions.
-- These helpers return only caller-scoped booleans/identity and validate auth.uid(); anon remains denied.
grant execute on function public.current_person_id() to authenticated;
grant execute on function public.is_administration_member(uuid) to authenticated;
grant execute on function public.can_manage_administration(uuid) to authenticated;
grant execute on function public.can_view_relationship(uuid) to authenticated;
revoke execute on function public.current_person_id() from anon, public;
revoke execute on function public.is_administration_member(uuid) from anon, public;
revoke execute on function public.can_manage_administration(uuid) from anon, public;
revoke execute on function public.can_view_relationship(uuid) from anon, public;