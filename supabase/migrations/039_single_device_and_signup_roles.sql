-- One live login per user, and signup trigger must accept dispatch / storeroom.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_login_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_login_at TIMESTAMPTZ;

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
  v_org UUID;
BEGIN
  v_role := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'role'), ''), 'operator');
  IF v_role NOT IN ('operator', 'mechanic', 'supervisor', 'manager', 'admin', 'dispatch', 'storeroom') THEN
    v_role := 'operator';
  END IF;

  v_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'User'
  );

  BEGIN
    v_site_id := NULLIF(trim(NEW.raw_user_meta_data->>'site_id'), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_site_id := NULL;
  END;

  IF v_site_id IS NULL THEN
    SELECT id INTO v_site_id FROM public.sites WHERE active IS NOT FALSE ORDER BY created_at LIMIT 1;
  END IF;
  IF v_site_id IS NULL THEN
    v_site_id := '00000000-0000-0000-0000-000000000001';
  END IF;

  SELECT organization_id INTO v_org FROM public.sites WHERE id = v_site_id;
  IF v_org IS NULL THEN
    v_org := '00000000-0000-0000-0000-000000000001';
  END IF;

  v_machine_id := NULLIF(trim(NEW.raw_user_meta_data->>'machine_id'), '');
  IF v_role = 'operator' AND (v_machine_id IS NULL OR v_machine_id = '') THEN
    SELECT id INTO v_machine_id FROM public.machines
    WHERE site_id = v_site_id AND active IS NOT FALSE
    ORDER BY created_at LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, name, role, site_id, machine_id, organization_id)
  VALUES (NEW.id, NEW.email, v_name, v_role, v_site_id, v_machine_id, v_org)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    role = EXCLUDED.role,
    site_id = COALESCE(EXCLUDED.site_id, public.profiles.site_id),
    machine_id = COALESCE(EXCLUDED.machine_id, public.profiles.machine_id),
    organization_id = COALESCE(EXCLUDED.organization_id, public.profiles.organization_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
