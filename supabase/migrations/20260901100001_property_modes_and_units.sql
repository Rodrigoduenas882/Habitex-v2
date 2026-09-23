-- ====================================================================
-- MIGRACIÓN 07: MODALIDADES DE INMUEBLE Y TABLA DE UNIDADES (UNITS)
-- ====================================================================

-- 1. Ampliar properties con rental_type, admin_fee, admin_fee_included, utility_mode
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS rental_type TEXT NOT NULL DEFAULT 'ROOM_RENTAL' 
  CHECK (rental_type IN ('FULL_PROPERTY', 'ROOM_RENTAL', 'INDEPENDENT_UNITS', 'SHARED_LIVING')),
ADD COLUMN IF NOT EXISTS admin_fee NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS admin_fee_included BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS utility_mode TEXT DEFAULT 'shared'
  CHECK (utility_mode IN ('shared', 'independent', 'included', 'hybrid'))
-- 2. Crear tabla units
CREATE TABLE IF NOT EXISTS public.units (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit_type TEXT NOT NULL DEFAULT 'ROOM' CHECK (unit_type IN ('FULL_PROPERTY', 'ROOM', 'STUDIO', 'SHARED_BED')),
  floor INTEGER NOT NULL DEFAULT 1,
  base_rent NUMERIC(12, 2) NOT NULL DEFAULT 0,
  deposit_amount NUMERIC(12, 2) DEFAULT 0,
  cutoff_day INTEGER NOT NULL DEFAULT 5,
  power_meter_id TEXT DEFAULT '',
  has_internet BOOLEAN DEFAULT true,
  has_tv BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
-- Indices
CREATE INDEX IF NOT EXISTS idx_units_property_id ON public.units(property_id)
-- RLS
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY
-- Owner Policies (Separate SELECT, INSERT, UPDATE, DELETE - Fail Closed)
DROP POLICY IF EXISTS "units_owner_select" ON public.units
CREATE POLICY "units_owner_select" ON public.units
FOR SELECT TO authenticated
USING (
  public.is_property_owner(property_id)
)
DROP POLICY IF EXISTS "units_owner_insert" ON public.units
CREATE POLICY "units_owner_insert" ON public.units
FOR INSERT TO authenticated
WITH CHECK (
  public.is_property_owner(property_id)
)
DROP POLICY IF EXISTS "units_owner_update" ON public.units
CREATE POLICY "units_owner_update" ON public.units
FOR UPDATE TO authenticated
USING (
  public.is_property_owner(property_id)
)
WITH CHECK (
  public.is_property_owner(property_id)
)
DROP POLICY IF EXISTS "units_owner_delete" ON public.units
CREATE POLICY "units_owner_delete" ON public.units
FOR DELETE TO authenticated
USING (
  public.is_property_owner(property_id)
)