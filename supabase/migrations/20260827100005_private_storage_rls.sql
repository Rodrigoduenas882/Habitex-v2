-- ====================================================================
-- MIGRACIÓN 05: BUCKETS PRIVADOS Y RLS DE STORAGE CON WITH CHECK
-- ====================================================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO UPDATE SET public = false
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET public = false
DROP POLICY IF EXISTS "storage_owner_receipts_select" ON storage.objects
DROP POLICY IF EXISTS "storage_owner_receipts_insert" ON storage.objects
DROP POLICY IF EXISTS "storage_owner_receipts_update" ON storage.objects
DROP POLICY IF EXISTS "storage_owner_receipts_delete" ON storage.objects
DROP POLICY IF EXISTS "storage_tenant_receipts_insert" ON storage.objects
DROP POLICY IF EXISTS "storage_owner_documents_select" ON storage.objects
DROP POLICY IF EXISTS "storage_owner_documents_insert" ON storage.objects
DROP POLICY IF EXISTS "storage_owner_documents_update" ON storage.objects
DROP POLICY IF EXISTS "storage_owner_documents_delete" ON storage.objects
DROP POLICY IF EXISTS "storage_tenant_documents_select" ON storage.objects
CREATE POLICY "storage_owner_receipts_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts' AND
    public.is_property_owner((storage.foldername(name))[1])
  )
CREATE POLICY "storage_owner_receipts_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts' AND
    public.is_property_owner((storage.foldername(name))[1])
  )
CREATE POLICY "storage_owner_receipts_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'receipts' AND
    public.is_property_owner((storage.foldername(name))[1])
  )
  WITH CHECK (
    bucket_id = 'receipts' AND
    public.is_property_owner((storage.foldername(name))[1])
  )
CREATE POLICY "storage_owner_receipts_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts' AND
    public.is_property_owner((storage.foldername(name))[1])
  )
CREATE POLICY "storage_tenant_receipts_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts' AND
    public.is_property_tenant((storage.foldername(name))[1])
  )
CREATE POLICY "storage_owner_documents_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents' AND
    public.is_property_owner((storage.foldername(name))[1])
  )
CREATE POLICY "storage_owner_documents_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents' AND
    public.is_property_owner((storage.foldername(name))[1])
  )
CREATE POLICY "storage_owner_documents_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents' AND
    public.is_property_owner((storage.foldername(name))[1])
  )
  WITH CHECK (
    bucket_id = 'documents' AND
    public.is_property_owner((storage.foldername(name))[1])
  )
CREATE POLICY "storage_owner_documents_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents' AND
    public.is_property_owner((storage.foldername(name))[1])
  )
CREATE POLICY "storage_tenant_documents_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents' AND
    public.is_tenant_self((storage.foldername(name))[2])
  )