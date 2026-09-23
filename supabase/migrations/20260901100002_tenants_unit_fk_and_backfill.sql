-- ====================================================================
-- MIGRACIÓN 08: VINCULACIÓN TENANT → UNIT Y BACKFILL IDEMPOTENTE
-- ====================================================================

-- 1. Agregar unit_id a tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS unit_id TEXT REFERENCES public.units(id) ON DELETE SET NULL
CREATE INDEX IF NOT EXISTS idx_tenants_unit_id ON public.tenants(unit_id)
-- Política para que el arrendatario pueda consultar su unidad asignada
DROP POLICY IF EXISTS "units_tenant_select" ON public.units
CREATE POLICY "units_tenant_select" ON public.units
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.unit_id = units.id
      AND t.auth_user_id = auth.uid()
  )
)
-- 2. Backfill idempotente de Units para propiedades y tenants existentes
DO $$
DECLARE
  p RECORD;
  t RECORD;
  new_unit_id TEXT;
BEGIN
  -- Para cada propiedad existente
  FOR p IN SELECT id, rental_type, total_rooms FROM public.properties LOOP
    
    -- Para cada tenant de esta propiedad sin unit_id
    FOR t IN SELECT id, room_number, floor, rent_amount, cutoff_day, has_internet, has_tv 
             FROM public.tenants 
             WHERE property_id = p.id AND (unit_id IS NULL OR unit_id = '') LOOP
      
      -- Verificar si ya existe una unit con ese nombre en esa propiedad
      SELECT id INTO new_unit_id FROM public.units 
      WHERE property_id = p.id AND name = COALESCE(NULLIF(t.room_number, ''), 'Habitación ' || t.id)
      LIMIT 1;

      IF new_unit_id IS NULL THEN
        new_unit_id := gen_random_uuid()::text;
        INSERT INTO public.units (
          id, property_id, name, unit_type, floor, base_rent, cutoff_day, has_internet, has_tv
        ) VALUES (
          new_unit_id,
          p.id,
          COALESCE(NULLIF(t.room_number, ''), 'Habitación ' || t.id),
          CASE WHEN p.rental_type = 'FULL_PROPERTY' THEN 'FULL_PROPERTY'
               WHEN p.rental_type = 'INDEPENDENT_UNITS' THEN 'STUDIO'
               ELSE 'ROOM' END,
          COALESCE(t.floor, 1),
          COALESCE(t.rent_amount, 0),
          COALESCE(t.cutoff_day, 5),
          COALESCE(t.has_internet, true),
          COALESCE(t.has_tv, false)
        );
      END IF;

      -- Asociar tenant con la unit
      UPDATE public.tenants SET unit_id = new_unit_id WHERE id = t.id;
    END LOOP;

    -- Si la propiedad no tiene ninguna unit creada aún, crear la unidad principal o inicial
    IF NOT EXISTS (SELECT 1 FROM public.units WHERE property_id = p.id) THEN
      INSERT INTO public.units (
        id, property_id, name, unit_type, floor, base_rent, cutoff_day
      ) VALUES (
        gen_random_uuid()::text,
        p.id,
        CASE WHEN p.rental_type = 'FULL_PROPERTY' THEN 'Unidad Principal' ELSE 'Habitación 101' END,
        CASE WHEN p.rental_type = 'FULL_PROPERTY' THEN 'FULL_PROPERTY' ELSE 'ROOM' END,
        1,
        0,
        5
      );
    END IF;
  END LOOP;
END $$