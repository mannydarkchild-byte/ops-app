-- Dispatch login records the site's daily production and sends it for sign-off.
-- Bucket counts are turned into tonnes with the factor saved on that day.

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS excavator_bucket_tonnes NUMERIC;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS fel_bucket_tonnes NUMERIC;

ALTER TABLE site_dispatch ADD COLUMN IF NOT EXISTS excavator_buckets INTEGER;
ALTER TABLE site_dispatch ADD COLUMN IF NOT EXISTS fel_buckets INTEGER;
ALTER TABLE site_dispatch ADD COLUMN IF NOT EXISTS excavator_bucket_tonnes NUMERIC;
ALTER TABLE site_dispatch ADD COLUMN IF NOT EXISTS fel_bucket_tonnes NUMERIC;
ALTER TABLE site_dispatch ADD COLUMN IF NOT EXISTS tonnes_screened NUMERIC;
ALTER TABLE site_dispatch ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE site_dispatch ADD COLUMN IF NOT EXISTS assigned_supervisor_id UUID;
ALTER TABLE site_dispatch ADD COLUMN IF NOT EXISTS assigned_supervisor_name TEXT;
ALTER TABLE site_dispatch ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE site_dispatch ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE site_dispatch ADD COLUMN IF NOT EXISTS signed_by UUID;
ALTER TABLE site_dispatch ADD COLUMN IF NOT EXISTS signed_by_name TEXT;
ALTER TABLE site_dispatch ADD COLUMN IF NOT EXISTS supervisor_comment TEXT;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'profiles'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('operator', 'mechanic', 'supervisor', 'manager', 'admin', 'dispatch'));

DROP POLICY IF EXISTS site_dispatch_all ON site_dispatch;
DROP POLICY IF EXISTS site_dispatch_read ON site_dispatch;
DROP POLICY IF EXISTS site_dispatch_write ON site_dispatch;

CREATE POLICY site_dispatch_read ON site_dispatch
  FOR SELECT TO authenticated
  USING (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'dispatch')
  );

CREATE POLICY site_dispatch_write ON site_dispatch
  FOR ALL TO authenticated
  USING (
    user_role() IN ('admin', 'manager', 'supervisor', 'dispatch')
    AND (site_id = user_site_id() OR user_role() IN ('admin', 'manager'))
  )
  WITH CHECK (
    user_role() IN ('admin', 'manager', 'supervisor', 'dispatch')
    AND (site_id = user_site_id() OR user_role() IN ('admin', 'manager'))
  );
