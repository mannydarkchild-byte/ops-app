-- Fix "Database error creating new user" when adding users in Supabase Auth
-- Run this in SQL Editor on your project, then try Add user again.

-- Ensure seed site + machine exist (safe to re-run)
INSERT INTO sites (id, name, code) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Malekaskraal', 'MLK')
ON CONFLICT (id) DO NOTHING;

INSERT INTO machines (id, site_id, name, code, type, start_hour_meter, billable_rate) VALUES
  ('W2100-001', '00000000-0000-0000-0000-000000000001', 'Powerscreen Warrior 2100', 'W2100', 'Screen', 5032, 1800)
ON CONFLICT (id) DO NOTHING;

INSERT INTO machine_status (machine_id, is_running) VALUES ('W2100-001', false)
ON CONFLICT (machine_id) DO NOTHING;

-- Robust signup trigger (lookup site/machine instead of hardcoded FK failure)
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
  v_role := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'role'), ''), 'operator');
  IF v_role NOT IN ('operator', 'mechanic', 'supervisor', 'manager', 'admin') THEN
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grants required for Supabase Auth to run the trigger
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role, supabase_auth_admin;

-- RLS: allow users to read their own profile; admins read all
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;
DROP POLICY IF EXISTS profiles_insert ON profiles;

CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (id = auth.uid() OR user_role() IN ('admin', 'manager'));

CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (user_role() = 'admin' OR id = auth.uid());

CREATE POLICY profiles_insert ON profiles FOR INSERT
  WITH CHECK (id = auth.uid() OR user_role() = 'admin');

-- Sites were missing a read policy (blocks app after login)
DROP POLICY IF EXISTS sites_read ON sites;
CREATE POLICY sites_read ON sites FOR SELECT USING (true);
