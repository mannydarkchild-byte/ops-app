-- OPS Mine Operations — FRESH PROJECT ONLY
-- Run once on a new empty Supabase project.
-- Safe to run on empty database. Do NOT run on existing project with data.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Sites & machines ───
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  timezone TEXT DEFAULT 'Africa/Johannesburg',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE machines (
  id TEXT PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT,
  start_hour_meter NUMERIC DEFAULT 0,
  billable_rate NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Single-operator lock — one running user per machine
CREATE TABLE machine_status (
  machine_id TEXT PRIMARY KEY REFERENCES machines(id),
  is_running BOOLEAN DEFAULT false,
  shift_id TEXT,
  operator_id UUID,
  operator_name TEXT,
  started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Users ───
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator'
    CHECK (role IN ('operator','mechanic','supervisor','manager','admin')),
  site_id UUID REFERENCES sites(id),
  machine_id TEXT REFERENCES machines(id),
  phone TEXT,
  shift_band TEXT DEFAULT 'any' CHECK (shift_band IN ('day', 'night', 'any')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
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
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Operations ───
CREATE TABLE shifts (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  machine_id TEXT NOT NULL REFERENCES machines(id),
  operator_id UUID,
  operator_name TEXT NOT NULL,
  assigned_supervisor_id UUID REFERENCES profiles(id),
  assigned_supervisor_name TEXT,
  shift_status TEXT NOT NULL DEFAULT 'RUNNING',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  start_hour_meter NUMERIC,
  end_hour_meter NUMERIC,
  hours_worked NUMERIC DEFAULT 0,
  verification_token TEXT,
  supervisor_comment TEXT,
  correction_history JSONB DEFAULT '[]',
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  supervisor_signature_ref TEXT,
  supervisor_signature_name TEXT,
  notes TEXT,
  is_manual BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  shift_id TEXT,
  machine_id TEXT NOT NULL,
  operator_id UUID,
  operator_name TEXT NOT NULL,
  type TEXT NOT NULL,
  reason TEXT,
  note TEXT,
  stopped_at TIMESTAMPTZ,
  restarted_at TIMESTAMPTZ,
  downtime_minutes NUMERIC,
  status TEXT,
  photo_data TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE work_sessions (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  machine_id TEXT,
  operator_id UUID,
  operator_name TEXT NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  notes TEXT,
  supervisor_signature TEXT,
  signature_name TEXT,
  signature_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE inspections (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  machine_id TEXT NOT NULL,
  operator_id UUID,
  operator_name TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'Pre-Start Inspection' | 'Mechanic Full'
  category TEXT NOT NULL DEFAULT 'General',
  item_name TEXT NOT NULL,
  status TEXT NOT NULL,
  photo TEXT,
  remark TEXT,
  inspection_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE fuel_logs (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  machine_id TEXT,
  shift_id TEXT,
  operator_id UUID,
  operator_name TEXT,
  litres NUMERIC,
  hour_meter NUMERIC,
  tank_level TEXT,
  photo_pump TEXT,
  photo_dipstick TEXT,
  note TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  machine_id TEXT,
  operator_id UUID,
  operator_name TEXT,
  category TEXT,
  amount NUMERIC,
  vendor TEXT,
  description TEXT,
  receipt_photo TEXT,
  date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE issues (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  machine_id TEXT,
  reporter_id UUID,
  reporter_name TEXT,
  current_owner_id UUID,
  current_owner_role TEXT,
  current_owner_name TEXT,
  area TEXT,
  priority TEXT,
  description TEXT,
  status TEXT DEFAULT 'OPEN',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolved_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE issue_messages (
  id TEXT PRIMARY KEY,
  issue_id TEXT REFERENCES issues(id) ON DELETE CASCADE,
  sender_id UUID,
  sender_name TEXT,
  sender_role TEXT,
  type TEXT,
  text TEXT,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE shift_submissions (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  machine_id TEXT,
  shift_id TEXT,
  operator_id UUID,
  operator_name TEXT,
  status TEXT,
  submitted_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  correction_number INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE shift_corrections (
  id TEXT PRIMARY KEY,
  shift_id TEXT,
  submission_id TEXT,
  correction_number INT,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  corrected_by UUID,
  corrected_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE machine_hour_readings (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  machine_id TEXT NOT NULL,
  operator_id UUID,
  operator_name TEXT,
  reading NUMERIC NOT NULL,
  photo_data TEXT,
  reading_at TIMESTAMPTZ NOT NULL,
  source TEXT DEFAULT 'manual',
  shift_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE breakdowns (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  machine_id TEXT,
  reported_by UUID,
  reported_by_name TEXT,
  assigned_to UUID,
  assigned_to_name TEXT,
  issue_id TEXT,
  title TEXT,
  description TEXT,
  diagnosis TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE maintenance_jobs (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  machine_id TEXT,
  breakdown_id TEXT REFERENCES breakdowns(id),
  mechanic_id UUID,
  mechanic_name TEXT,
  title TEXT,
  work_performed TEXT,
  labour_hours NUMERIC,
  recommendations TEXT,
  status TEXT DEFAULT 'in_progress',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE maintenance_parts (
  id TEXT PRIMARY KEY,
  maintenance_job_id TEXT REFERENCES maintenance_jobs(id) ON DELETE CASCADE,
  part_name TEXT,
  quantity NUMERIC DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  sku TEXT,
  name TEXT NOT NULL,
  category TEXT,
  quantity_on_hand NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'each',
  reorder_level NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE inventory_movements (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  inventory_item_id TEXT REFERENCES inventory_items(id),
  maintenance_job_id TEXT,
  quantity_change NUMERIC NOT NULL,
  reason TEXT,
  performed_by UUID,
  performed_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Indexes ───
CREATE INDEX idx_shifts_updated ON shifts(updated_at);
CREATE INDEX idx_events_updated ON events(updated_at);
CREATE INDEX idx_inspections_updated ON inspections(updated_at);
CREATE INDEX idx_fuel_logs_updated ON fuel_logs(updated_at);
CREATE INDEX idx_issues_updated ON issues(updated_at);
CREATE INDEX idx_shifts_running ON shifts(machine_id, shift_status) WHERE shift_status = 'RUNNING';

-- ─── updated_at trigger ───
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sites_updated BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_machines_updated BEFORE UPDATE ON machines FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_work_sessions_updated BEFORE UPDATE ON work_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_inspections_updated BEFORE UPDATE ON inspections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_fuel_logs_updated BEFORE UPDATE ON fuel_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Machine lock RPCs (use machine_status) ───
CREATE OR REPLACE FUNCTION start_machine(p_machine_id TEXT, p_shift_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE v_running BOOLEAN;
BEGIN
  SELECT is_running INTO v_running FROM machine_status WHERE machine_id = p_machine_id FOR UPDATE;
  IF v_running IS TRUE THEN RETURN false; END IF;
  INSERT INTO machine_status (machine_id, is_running, shift_id, operator_id, operator_name, started_at, updated_at)
  VALUES (p_machine_id, true, p_shift_id, auth.uid(), (SELECT name FROM profiles WHERE id = auth.uid()), now(), now())
  ON CONFLICT (machine_id) DO UPDATE SET
    is_running = true, shift_id = p_shift_id, operator_id = auth.uid(),
    operator_name = (SELECT name FROM profiles WHERE id = auth.uid()),
    started_at = now(), updated_at = now();
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION stop_machine(p_machine_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE machine_status SET is_running = false, updated_at = now() WHERE machine_id = p_machine_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION verify_shift(p_shift_id TEXT, p_verification_token TEXT, p_action TEXT, p_reason TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM shifts WHERE id = p_shift_id AND verification_token = p_verification_token) THEN
    RAISE EXCEPTION 'Invalid shift or token';
  END IF;
  IF p_action = 'verify' THEN
    UPDATE shifts SET shift_status = 'VERIFIED', verified_at = now(), verified_by = auth.uid(), verification_token = NULL WHERE id = p_shift_id;
  ELSIF p_action IN ('correct', 'escalate') THEN
    UPDATE shifts SET shift_status = 'CORRECTION_REQUIRED', supervisor_comment = COALESCE(p_reason, 'Correction required'), verification_token = NULL WHERE id = p_shift_id;
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── RLS helpers ───
CREATE OR REPLACE FUNCTION user_site_id() RETURNS UUID AS $$
  SELECT site_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_role() RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable RLS
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_hour_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE breakdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON profiles FOR SELECT USING (id = auth.uid() OR user_role() IN ('admin','manager'));
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (user_role() = 'admin' OR id = auth.uid());
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (id = auth.uid() OR user_role() = 'admin');

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role, supabase_auth_admin;
GRANT ALL ON public.profiles TO postgres, service_role;

CREATE POLICY sites_read ON sites FOR SELECT USING (true);
CREATE POLICY machines_read ON machines FOR SELECT USING (true);
CREATE POLICY shifts_all ON shifts FOR ALL USING (site_id = user_site_id() OR user_role() IN ('admin','manager','supervisor','operator'));
CREATE POLICY events_all ON events FOR ALL USING (site_id = user_site_id() OR user_role() IN ('admin','manager','supervisor','operator'));
CREATE POLICY inspections_all ON inspections FOR ALL USING (site_id = user_site_id() OR user_role() IN ('admin','manager','supervisor','operator','mechanic'));
CREATE POLICY fuel_logs_all ON fuel_logs FOR ALL USING (site_id = user_site_id() OR user_role() IN ('admin','manager','supervisor','operator'));
CREATE POLICY work_sessions_all ON work_sessions FOR ALL USING (site_id = user_site_id() OR user_role() IN ('admin','manager','supervisor','operator'));
CREATE POLICY issues_all ON issues FOR ALL USING (site_id = user_site_id() OR user_role() IN ('admin','manager','supervisor','operator','mechanic'));
CREATE POLICY machine_status_read ON machine_status FOR SELECT USING (true);
CREATE POLICY admin_audit ON audit_log FOR SELECT USING (user_role() IN ('admin','manager'));

-- Storage bucket for photos/audio
INSERT INTO storage.buckets (id, name, public) VALUES ('ops-media', 'ops-media', true) ON CONFLICT DO NOTHING;

CREATE POLICY ops_media_read ON storage.objects FOR SELECT USING (bucket_id = 'ops-media');
CREATE POLICY ops_media_insert ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ops-media' AND auth.role() = 'authenticated');

-- ─── Seed site + machine ───
INSERT INTO sites (id, name, code) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Malekaskraal', 'MLK');

INSERT INTO machines (id, site_id, name, code, type, start_hour_meter, billable_rate) VALUES
  ('W2100-001', '00000000-0000-0000-0000-000000000001', 'Powerscreen Warrior 2100', 'W2100', 'Screen', 5032, 1800);

INSERT INTO machine_status (machine_id, is_running) VALUES ('W2100-001', false);
