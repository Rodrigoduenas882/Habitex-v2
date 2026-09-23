-- ====================================================================
-- MIGRACIÓN 09: TABLAS NORMALIZADAS DE GASTOS COMPARTIDOS (SHARED EXPENSES)
-- ====================================================================

-- 1. Tabla shared_expenses
CREATE TABLE IF NOT EXISTS public.shared_expenses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  paid_by_id TEXT NOT NULL REFERENCES public.tenants(id),
  category TEXT NOT NULL DEFAULT 'Otro' CHECK (category IN ('Servicios', 'Mercado', 'Aseo', 'Arriendo', 'Reparaciones', 'Comida / Salidas', 'Otro')),
  split_mode TEXT NOT NULL DEFAULT 'EQUAL' CHECK (split_mode IN ('EQUAL', 'CUSTOM')),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_settled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
CREATE INDEX IF NOT EXISTS idx_shared_expenses_property_id ON public.shared_expenses(property_id)
CREATE INDEX IF NOT EXISTS idx_shared_expenses_paid_by_id ON public.shared_expenses(paid_by_id)
-- 2. Tabla shared_expense_participants
CREATE TABLE IF NOT EXISTS public.shared_expense_participants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  expense_id TEXT NOT NULL REFERENCES public.shared_expenses(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  share_amount NUMERIC(12, 2) NOT NULL CHECK (share_amount >= 0),
  settled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_expense_tenant UNIQUE (expense_id, tenant_id)
)
CREATE INDEX IF NOT EXISTS idx_expense_participants_expense_id ON public.shared_expense_participants(expense_id)
CREATE INDEX IF NOT EXISTS idx_expense_participants_tenant_id ON public.shared_expense_participants(tenant_id)
-- RLS
ALTER TABLE public.shared_expenses ENABLE ROW LEVEL SECURITY
ALTER TABLE public.shared_expense_participants ENABLE ROW LEVEL SECURITY
-- 3. RLS para shared_expenses (Separate SELECT, INSERT, UPDATE, DELETE)
-- SELECT: Owner o Tenant de la propiedad
DROP POLICY IF EXISTS "shared_expenses_select" ON public.shared_expenses
CREATE POLICY "shared_expenses_select" ON public.shared_expenses
FOR SELECT TO authenticated
USING (
  public.is_property_owner(property_id) OR public.is_property_tenant(property_id)
)
-- INSERT: Owner o Tenant de la propiedad
DROP POLICY IF EXISTS "shared_expenses_insert" ON public.shared_expenses
CREATE POLICY "shared_expenses_insert" ON public.shared_expenses
FOR INSERT TO authenticated
WITH CHECK (
  public.is_property_owner(property_id) OR (
    public.is_property_tenant(property_id) AND public.is_tenant_self(paid_by_id)
  )
)
-- UPDATE: Owner o el Tenant que pagó el gasto
DROP POLICY IF EXISTS "shared_expenses_update" ON public.shared_expenses
CREATE POLICY "shared_expenses_update" ON public.shared_expenses
FOR UPDATE TO authenticated
USING (
  public.is_property_owner(property_id) OR (
    public.is_property_tenant(property_id) AND public.is_tenant_self(paid_by_id)
  )
)
WITH CHECK (
  public.is_property_owner(property_id) OR (
    public.is_property_tenant(property_id) AND public.is_tenant_self(paid_by_id)
  )
)
-- DELETE: Owner o el Tenant que pagó el gasto
DROP POLICY IF EXISTS "shared_expenses_delete" ON public.shared_expenses
CREATE POLICY "shared_expenses_delete" ON public.shared_expenses
FOR DELETE TO authenticated
USING (
  public.is_property_owner(property_id) OR (
    public.is_property_tenant(property_id) AND public.is_tenant_self(paid_by_id)
  )
)
-- 4. RLS para shared_expense_participants
-- SELECT: Owner o Tenant de la propiedad asociada al gasto
DROP POLICY IF EXISTS "expense_participants_select" ON public.shared_expense_participants
CREATE POLICY "expense_participants_select" ON public.shared_expense_participants
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shared_expenses se
    WHERE se.id = shared_expense_participants.expense_id
      AND (public.is_property_owner(se.property_id) OR public.is_property_tenant(se.property_id))
  )
)
-- INSERT: Owner o Tenant de la propiedad
DROP POLICY IF EXISTS "expense_participants_insert" ON public.shared_expense_participants
CREATE POLICY "expense_participants_insert" ON public.shared_expense_participants
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.shared_expenses se
    WHERE se.id = shared_expense_participants.expense_id
      AND (public.is_property_owner(se.property_id) OR public.is_property_tenant(se.property_id))
  )
)
-- UPDATE: Owner o Tenant involucrado
DROP POLICY IF EXISTS "expense_participants_update" ON public.shared_expense_participants
CREATE POLICY "expense_participants_update" ON public.shared_expense_participants
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shared_expenses se
    WHERE se.id = shared_expense_participants.expense_id
      AND (public.is_property_owner(se.property_id) OR public.is_property_tenant(se.property_id))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.shared_expenses se
    WHERE se.id = shared_expense_participants.expense_id
      AND (public.is_property_owner(se.property_id) OR public.is_property_tenant(se.property_id))
  )
)
-- DELETE: Owner o Tenant que pagó el gasto
DROP POLICY IF EXISTS "expense_participants_delete" ON public.shared_expense_participants
CREATE POLICY "expense_participants_delete" ON public.shared_expense_participants
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shared_expenses se
    WHERE se.id = shared_expense_participants.expense_id
      AND (public.is_property_owner(se.property_id) OR (
        public.is_property_tenant(se.property_id) AND public.is_tenant_self(se.paid_by_id)
      ))
  )
)