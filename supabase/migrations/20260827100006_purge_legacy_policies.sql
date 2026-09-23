-- Migration 06: Purge legacy permissive RLS policies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname NOT IN (
        'profiles_select_own',
        'profiles_insert_own',
        'profiles_update_own',
        'subscriptions_select_own',
        'properties_owner_all',
        'properties_tenant_select',
        'tenants_owner_all',
        'tenants_resident_select',
        'bills_owner_all',
        'bills_resident_select',
        'payments_owner_all',
        'payments_tenant_select',
        'payments_tenant_insert',
        'cleaning_owner_all',
        'cleaning_tenant_select',
        'documents_owner_all',
        'documents_tenant_select'
      )
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END;
$$