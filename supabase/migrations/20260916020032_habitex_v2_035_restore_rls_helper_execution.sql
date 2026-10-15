-- RLS policies execute these auth-context helpers as the authenticated caller.
-- Keep them unavailable to anon/public, but authenticated needs EXECUTE for policy evaluation.
grant execute on function public.current_person_id() to authenticated;
grant execute on function public.is_administration_member(uuid) to authenticated;
grant execute on function public.can_view_relationship(uuid) to authenticated;
grant execute on function public.can_manage_administration(uuid) to authenticated;

revoke execute on function public.current_person_id() from anon, public;
revoke execute on function public.is_administration_member(uuid) from anon, public;
revoke execute on function public.can_view_relationship(uuid) from anon, public;
revoke execute on function public.can_manage_administration(uuid) from anon, public;