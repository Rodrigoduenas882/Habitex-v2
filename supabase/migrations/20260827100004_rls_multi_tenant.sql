-- ====================================================================
-- MIGRACIÓN 04: POLÍTICAS RLS MULTI-TENANT CON BOUNDARY HELPERS
-- ====================================================================

-- 1. Helper functions con SECURITY DEFINER para eliminar recursión infinita
CREATE OR REPLACE FUNCTION public.is_property_owner(p_property_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties 
    WHERE id = p_property_id AND user_id = auth.uid()
  );
$$
CREATE OR REPLACE FUNCTION public.is_property_tenant(p_property_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants 
    WHERE property_id = p_property_id AND auth_user_id = auth.uid()
  );
$$
CREATE OR REPLACE FUNCTION public.is_tenant_self(p_tenant_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants 
    WHERE id = p_tenant_id AND auth_user_id = auth.uid()
  );
$$
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY
ALTER TABLE public.utility_bills ENABLE ROW LEVEL SECURITY
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY
ALTER TABLE public.cleaning_shifts ENABLE ROW LEVEL SECURITY
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions
DROP POLICY IF EXISTS "properties_owner_all" ON public.properties
DROP POLICY IF EXISTS "properties_tenant_select" ON public.properties
DROP POLICY IF EXISTS "tenants_owner_all" ON public.tenants
DROP POLICY IF EXISTS "tenants_resident_select" ON public.tenants
DROP POLICY IF EXISTS "bills_owner_all" ON public.utility_bills
DROP POLICY IF EXISTS "bills_resident_select" ON public.utility_bills
DROP POLICY IF EXISTS "payments_owner_all" ON public.payments
DROP POLICY IF EXISTS "payments_tenant_select" ON public.payments
DROP POLICY IF EXISTS "payments_tenant_insert" ON public.payments
DROP POLICY IF EXISTS "cleaning_owner_all" ON public.cleaning_shifts
DROP POLICY IF EXISTS "cleaning_tenant_select" ON public.cleaning_shifts
DROP POLICY IF EXISTS "documents_owner_all" ON public.documents
DROP POLICY IF EXISTS "documents_tenant_select" ON public.documents
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid())
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid())
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid())
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid())
CREATE POLICY "properties_owner_all" ON public.properties
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid())
CREATE POLICY "properties_tenant_select" ON public.properties
  FOR SELECT TO authenticated
  USING (public.is_property_tenant(id))
CREATE POLICY "tenants_owner_all" ON public.tenants
  FOR ALL TO authenticated
  USING (public.is_property_owner(property_id))
  WITH CHECK (public.is_property_owner(property_id))
CREATE POLICY "tenants_resident_select" ON public.tenants
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid())
CREATE POLICY "bills_owner_all" ON public.utility_bills
  FOR ALL TO authenticated
  USING (public.is_property_owner(property_id))
CREATE POLICY "bills_resident_select" ON public.utility_bills
  FOR SELECT TO authenticated
  USING (public.is_property_tenant(property_id))
CREATE POLICY "payments_owner_all" ON public.payments
  FOR ALL TO authenticated
  USING (public.is_property_owner(property_id))
CREATE POLICY "payments_tenant_select" ON public.payments
  FOR SELECT TO authenticated
  USING (public.is_tenant_self(tenant_id))
CREATE POLICY "payments_tenant_insert" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_self(tenant_id))
CREATE POLICY "cleaning_owner_all" ON public.cleaning_shifts
  FOR ALL TO authenticated
  USING (public.is_property_owner(property_id))
CREATE POLICY "cleaning_tenant_select" ON public.cleaning_shifts
  FOR SELECT TO authenticated
  USING (public.is_property_tenant(property_id))
CREATE POLICY "documents_owner_all" ON public.documents
  FOR ALL TO authenticated
  USING (public.is_property_owner(property_id))
CREATE POLICY "documents_tenant_select" ON public.documents
  FOR SELECT TO authenticated
  USING (public.is_tenant_self(tenant_id))