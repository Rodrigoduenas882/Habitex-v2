-- Internal RLS helpers remain SECURITY DEFINER to avoid recursive RLS,
-- but are no longer directly executable through the authenticated API role.
revoke execute on function public.current_person_id() from authenticated;
revoke execute on function public.is_administration_member(uuid) from authenticated;
revoke execute on function public.can_manage_administration(uuid) from authenticated;
revoke execute on function public.can_view_relationship(uuid) from authenticated;
-- bootstrap_account and activate_rental_relationship intentionally remain authenticated RPC commands;
-- both validate auth.uid() and authorization internally and expose controlled domain operations.