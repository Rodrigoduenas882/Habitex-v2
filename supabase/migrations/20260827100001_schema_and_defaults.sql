CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
ALTER TABLE public.properties 
  ALTER COLUMN user_id SET DEFAULT auth.uid()
ALTER TABLE public.subscriptions 
  ALTER COLUMN user_id SET DEFAULT auth.uid()
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_subscription'
  ) THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT unique_user_subscription UNIQUE (user_id);
  END IF;
END $$
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invitation_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_auth_user_id ON public.tenants (auth_user_id) WHERE auth_user_id IS NOT NULL
CREATE INDEX IF NOT EXISTS idx_tenants_invitation_token ON public.tenants (invitation_token) WHERE invitation_token IS NOT NULL
CREATE INDEX IF NOT EXISTS idx_properties_user_id ON public.properties (user_id)
CREATE INDEX IF NOT EXISTS idx_tenants_property_id ON public.tenants (property_id)
CREATE INDEX IF NOT EXISTS idx_payments_property_id ON public.payments (property_id)
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON public.payments (tenant_id)
CREATE INDEX IF NOT EXISTS idx_documents_property_id ON public.documents (property_id)
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON public.documents (tenant_id)