-- ====================================================================
-- MIGRACIÓN 10: TABLA CONTRACTS, RLS MULTI-TENANT, RPC PÚBLICA Y STORAGE
-- ====================================================================

-- 1. Crear tabla public.contracts
CREATE TABLE IF NOT EXISTS public.contracts (
  id TEXT PRIMARY KEY DEFAULT ('ct-' || gen_random_uuid()::text),
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'GENERATED', 'SHARED', 'SIGNED', 'TERMINATED')),
  version INTEGER NOT NULL DEFAULT 1,
  public_token TEXT UNIQUE NOT NULL,
  superseded_tokens TEXT[] NOT NULL DEFAULT '{}',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_months INTEGER NOT NULL DEFAULT 12,
  rent_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cutoff_day INTEGER NOT NULL DEFAULT 5 CHECK (cutoff_day BETWEEN 1 AND 31),
  admin_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  admin_fee_mode TEXT NOT NULL DEFAULT 'NONE' CHECK (admin_fee_mode IN ('INCLUDED', 'SEPARATE', 'NONE')),
  services_mode TEXT NOT NULL DEFAULT 'TENANT_DIRECT' CHECK (services_mode IN ('TENANT_DIRECT', 'INCLUDED', 'SEPARATE_BILLING')),
  guarantor JSONB DEFAULT NULL,
  penalty_clause TEXT DEFAULT '2 cánones de arrendamiento',
  terms_snapshot JSONB DEFAULT NULL,
  shared_at TIMESTAMPTZ DEFAULT NULL,
  shared_channel TEXT DEFAULT NULL CHECK (shared_channel IS NULL OR shared_channel IN ('WHATSAPP', 'EMAIL', 'LINK_COPY')),
  signed_at TIMESTAMPTZ DEFAULT NULL,
  signed_type TEXT DEFAULT NULL CHECK (signed_type IS NULL OR signed_type IN ('PHYSICAL')),
  signed_document_id TEXT REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
-- Índices de búsqueda y rendimiento
CREATE INDEX IF NOT EXISTS idx_contracts_property_id ON public.contracts(property_id)
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_id ON public.contracts(tenant_id)
CREATE INDEX IF NOT EXISTS idx_contracts_public_token ON public.contracts(public_token)
-- 2. Configuración de Row Level Security (RLS) en public.contracts
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY
-- Propietario de la propiedad: control total sobre contratos de sus propiedades
DROP POLICY IF EXISTS "contracts_owner_all" ON public.contracts
CREATE POLICY "contracts_owner_all" ON public.contracts
FOR ALL TO authenticated
USING (
  public.is_property_owner(property_id)
)
WITH CHECK (
  public.is_property_owner(property_id)
)
-- Arrendatario autenticado: lectura de contratos de su propiedad
DROP POLICY IF EXISTS "contracts_tenant_select" ON public.contracts
CREATE POLICY "contracts_tenant_select" ON public.contracts
FOR SELECT TO authenticated
USING (
  public.is_property_tenant(property_id)
)
-- 3. Función RPC Pública Segura (SECURITY DEFINER, Fail-Closed)
CREATE OR REPLACE FUNCTION public.get_public_contract_by_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_contract RECORD;
  v_doc RECORD;
  v_result JSONB;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND', 'message', 'Token no proporcionado');
  END IF;

  -- A. Verificar si el token fue reemplazado por una regeneración posterior
  IF EXISTS (
    SELECT 1 FROM public.contracts 
    WHERE p_token = ANY(superseded_tokens)
  ) THEN
    RETURN jsonb_build_object(
      'error', 'VERSION_SUPERSEDED',
      'message', 'El contrato fue actualizado. Debes solicitar el nuevo enlace al arrendador.'
    );
  END IF;

  -- B. Buscar contrato por su token vigente
  SELECT * INTO v_contract
  FROM public.contracts
  WHERE public_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND', 'message', 'Contrato no encontrado');
  END IF;

  -- C. Validar que el estado permita consulta pública (SHARED, SIGNED, TERMINATED)
  IF v_contract.status NOT IN ('SHARED', 'SIGNED', 'TERMINATED') THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND', 'message', 'El contrato no está disponible públicamente');
  END IF;

  -- D. Obtener metadata del documento firmado si existe
  v_doc := NULL;
  IF v_contract.signed_document_id IS NOT NULL THEN
    SELECT id, title, file_url, size, created_at INTO v_doc
    FROM public.documents
    WHERE id = v_contract.signed_document_id;
  END IF;

  -- E. Construir respuesta mínima y sanitizada
  v_result := jsonb_build_object(
    'id', v_contract.id,
    'property_id', v_contract.property_id,
    'tenant_id', v_contract.tenant_id,
    'status', v_contract.status,
    'version', v_contract.version,
    'start_date', v_contract.start_date,
    'duration_months', v_contract.duration_months,
    'rent_amount', v_contract.rent_amount,
    'cutoff_day', v_contract.cutoff_day,
    'admin_fee', v_contract.admin_fee,
    'admin_fee_mode', v_contract.admin_fee_mode,
    'services_mode', v_contract.services_mode,
    'guarantor', v_contract.guarantor,
    'penalty_clause', v_contract.penalty_clause,
    'terms_snapshot', v_contract.terms_snapshot,
    'shared_at', v_contract.shared_at,
    'shared_channel', v_contract.shared_channel,
    'signed_at', v_contract.signed_at,
    'signed_type', v_contract.signed_type,
    'has_signed_document', (v_contract.signed_document_id IS NOT NULL),
    'signed_document', CASE 
      WHEN v_doc.id IS NOT NULL THEN jsonb_build_object(
        'id', v_doc.id,
        'title', v_doc.title,
        'file_url', v_doc.file_url,
        'size', v_doc.size,
        'created_at', v_doc.created_at
      )
      ELSE NULL
    END
  );

  RETURN v_result;
END;
$$
-- Permisos estrictos para RPC pública
REVOKE EXECUTE ON FUNCTION public.get_public_contract_by_token(TEXT) FROM PUBLIC
GRANT EXECUTE ON FUNCTION public.get_public_contract_by_token(TEXT) TO anon, authenticated
-- 4. Política de Storage para descarga segura de contratos formalizados o finalizados
DROP POLICY IF EXISTS "storage_public_contract_signed_document_select" ON storage.objects
CREATE POLICY "storage_public_contract_signed_document_select" ON storage.objects
FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.documents d ON c.signed_document_id = d.id
    WHERE c.status IN ('SIGNED', 'TERMINATED')
      AND d.file_url = storage.objects.name
  )
)