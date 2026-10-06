-- Production hardening:
-- 1) Stop privilege escalation via self-service profile updates (role/active/site/machine)
-- 2) Do not allow signup metadata to mint admin accounts
-- 3) Restrict site_settings writes to admin/manager

-- ─── Protect privileged profile columns ───
CREATE OR REPLACE FUNCTION public.protect_profile_privilege_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

  IF COALESCE(caller_role, '') <> 'admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.active IS DISTINCT FROM OLD.active
       OR NEW.site_id IS DISTINCT FROM OLD.site_id
       OR NEW.machine_id IS DISTINCT FROM OLD.machine_id THEN
      RAISE EXCEPTION 'Only admins can change role, active status, site, or machine assignment';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privilege_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_privilege_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privilege_fields();

-- ─── Signup: never mint admin from client metadata ───
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_site_id UUID;
  v_machine_id TEXT;
  v_role TEXT;
  v_name TEXT;
BEGIN
  -- Admin must be granted by an existing admin (or SQL), never via signup metadata.
  v_role := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'role'), ''), 'operator');
  IF v_role NOT IN ('operator', 'mechanic', 'supervisor', 'manager') THEN
    v_role := 'operator';
  END IF;

  v_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'User'
  );

  SELECT id INTO v_site_id FROM public.sites WHERE active IS NOT FALSE ORDER BY created_at LIMIT 1;
  IF v_site_id IS NULL THEN
    v_site_id := '00000000-0000-0000-0000-000000000001';
  END IF;

  IF v_role = 'operator' THEN
    SELECT id INTO v_machine_id FROM public.machines
    WHERE site_id = v_site_id AND active IS NOT FALSE
    ORDER BY created_at LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, name, role, site_id, machine_id)
  VALUES (NEW.id, NEW.email, v_name, v_role, v_site_id, v_machine_id);

  RETURN NEW;
END;
$$;

-- ─── site_settings: authenticated write-all was too open ───
DROP POLICY IF EXISTS "site_settings_write" ON site_settings;
DROP POLICY IF EXISTS site_settings_write ON site_settings;

CREATE POLICY site_settings_write ON site_settings
  FOR ALL TO authenticated
  USING (user_role() IN ('admin', 'manager'))
  WITH CHECK (user_role() IN ('admin', 'manager'));
