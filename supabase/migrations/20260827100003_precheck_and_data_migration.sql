CREATE OR REPLACE VIEW public.v_tenants_migration_precheck AS
WITH email_counts AS (
  SELECT LOWER(TRIM(email)) AS clean_email, COUNT(*) as tenant_count
  FROM public.tenants
  WHERE email IS NOT NULL AND TRIM(email) <> ''
  GROUP BY LOWER(TRIM(email))
),
classified_tenants AS (
  SELECT 
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.property_id,
    t.email AS original_email,
    u.id AS matching_auth_id,
    CASE 
      WHEN t.auth_user_id IS NOT NULL THEN 'ALREADY_LINKED'
      WHEN t.email IS NULL OR TRIM(t.email) = '' THEN 'NO_EMAIL'
      WHEN ec.tenant_count > 1 THEN 'AMBIGUOUS_DUPLICATE_TENANT_EMAIL'
      WHEN u.id IS NULL THEN 'NO_AUTH_USER'
      WHEN EXISTS (
        SELECT 1 FROM public.tenants t2 
        WHERE t2.auth_user_id = u.id AND t2.id <> t.id
      ) THEN 'AMBIGUOUS_AUTH_USER_ALREADY_TAKEN'
      ELSE 'SAFE_TO_LINK'
    END AS migration_status
  FROM public.tenants t
  LEFT JOIN email_counts ec ON LOWER(TRIM(t.email)) = ec.clean_email
  LEFT JOIN auth.users u ON LOWER(TRIM(t.email)) = LOWER(TRIM(u.email))
)
SELECT * FROM classified_tenants
UPDATE public.tenants t
SET 
  auth_user_id = u.id,
  invitation_token = NULL,
  invitation_expires_at = NULL,
  updated_at = NOW()
FROM auth.users u
WHERE LOWER(TRIM(t.email)) = LOWER(TRIM(u.email))
  AND t.auth_user_id IS NULL
  AND t.id IN (
    SELECT tenant_id FROM public.v_tenants_migration_precheck
    WHERE migration_status = 'SAFE_TO_LINK'
  )