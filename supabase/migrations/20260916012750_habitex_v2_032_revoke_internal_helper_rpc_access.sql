revoke execute on function public.current_person_id() from authenticated, anon, public;
revoke execute on function public.can_manage_administration(uuid) from authenticated, anon, public;
revoke execute on function public.can_view_relationship(uuid) from authenticated, anon, public;
revoke execute on function public.is_administration_member(uuid) from authenticated, anon, public;
revoke execute on function public.has_administration_management_role(uuid) from authenticated, anon, public;
revoke execute on function public.has_management_access(uuid) from authenticated, anon, public;
revoke execute on function public.active_relationship_count(uuid) from authenticated, anon, public;
revoke execute on function public.relationship_capacity_available(uuid) from authenticated, anon, public;