CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'tenant', 'admin')),
  phone TEXT,
  country TEXT DEFAULT 'CO',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'PRO' CHECK (plan IN ('BASIC', 'PRO', 'ENTERPRISE', 'CUSTOM')),
  custom_modules JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled')),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
CREATE TABLE IF NOT EXISTS public.properties (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT DEFAULT 'Bogotá',
  country TEXT DEFAULT 'CO',
  floors INTEGER DEFAULT 2,
  total_rooms INTEGER DEFAULT 6,
  landlord JSONB NOT NULL DEFAULT '{"name": "Luz Bertha Chaparro", "docType": "CC", "docNumber": "39533374", "phone": "3102212123", "city": "Bogotá"}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
CREATE TABLE IF NOT EXISTS public.tenants (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  floor INTEGER DEFAULT 1,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'ARR' CHECK (role IN ('ARR', 'PRO')),
  doc_type TEXT DEFAULT 'CC',
  doc_number TEXT,
  nationality TEXT DEFAULT 'Colombiano',
  phone TEXT,
  email TEXT,
  people_count INTEGER DEFAULT 1,
  has_internet BOOLEAN DEFAULT true,
  has_tv BOOLEAN DEFAULT false,
  is_principal BOOLEAN DEFAULT true,
  start_date DATE DEFAULT CURRENT_DATE,
  rent_amount NUMERIC(12, 2) DEFAULT 0,
  cutoff_day INTEGER DEFAULT 1,
  status TEXT DEFAULT 'Activo' CHECK (status IN ('Activo', 'Inactivo', 'En Mora')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
CREATE TABLE IF NOT EXISTS public.utility_bills (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  period_month TEXT NOT NULL,
  period_year INTEGER NOT NULL,
  water_amount NUMERIC(12, 2) DEFAULT 0,
  power_amount NUMERIC(12, 2) DEFAULT 0,
  gas_amount NUMERIC(12, 2) DEFAULT 0,
  internet_amount NUMERIC(12, 2) DEFAULT 0,
  tv_amount NUMERIC(12, 2) DEFAULT 0,
  gas_floor_1 NUMERIC(12, 2) DEFAULT 0,
  gas_floor_2 NUMERIC(12, 2) DEFAULT 0,
  gas_floor_3 NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_period_property UNIQUE (property_id, period_month, period_year)
)
CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id TEXT REFERENCES public.tenants(id) ON DELETE SET NULL,
  tenant_name TEXT NOT NULL,
  room_number TEXT,
  receipt_number TEXT,
  date DATE DEFAULT CURRENT_DATE,
  amount NUMERIC(12, 2) NOT NULL,
  concept TEXT,
  payment_method TEXT DEFAULT 'Efectivo',
  period TEXT,
  status TEXT DEFAULT 'Pagado' CHECK (status IN ('Pendiente', 'Pagado', 'Rechazado')),
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
CREATE TABLE IF NOT EXISTS public.cleaning_shifts (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id TEXT REFERENCES public.tenants(id) ON DELETE CASCADE,
  week_date DATE NOT NULL,
  floor INTEGER DEFAULT 1,
  status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'Completado', 'Atrasado')),
  created_at TIMESTAMPTZ DEFAULT NOW()
)
CREATE TABLE IF NOT EXISTS public.documents (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id TEXT REFERENCES public.tenants(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'Contrato',
  file_url TEXT NOT NULL,
  size TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)