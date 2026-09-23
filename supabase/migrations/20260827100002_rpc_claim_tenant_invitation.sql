CREATE OR REPLACE FUNCTION public.claim_tenant_invitation(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_caller_id UUID;
  v_tenant_id TEXT;
  v_property_id TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: debe iniciar sesión primero' 
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.tenants WHERE auth_user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Conflicto: este usuario ya tiene una habitación activa asignada'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.tenants
  SET 
    auth_user_id = v_caller_id,
    invitation_token = NULL,
    invitation_expires_at = NULL,
    updated_at = NOW()
  WHERE invitation_token = p_token
    AND invitation_expires_at > NOW()
    AND auth_user_id IS NULL
  RETURNING id, property_id INTO v_tenant_id, v_property_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'La invitación es inválida, ha expirado o ya fue utilizada'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
  SET role = 'tenant', updated_at = NOW()
  WHERE id = v_caller_id;

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_tenant_id,
    'property_id', v_property_id
  );
END;
$$
ALTER FUNCTION public.claim_tenant_invitation(UUID) OWNER TO postgres
REVOKE ALL ON FUNCTION public.claim_tenant_invitation(UUID) FROM PUBLIC
REVOKE EXECUTE ON FUNCTION public.claim_tenant_invitation(UUID) FROM anon
GRANT EXECUTE ON FUNCTION public.claim_tenant_invitation(UUID) TO authenticated
GRANT EXECUTE ON FUNCTION public.claim_tenant_invitation(UUID) TO service_role