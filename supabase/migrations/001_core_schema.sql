-- OPS Mine Operations — core schema
-- Run via Supabase SQL editor or CLI: supabase db push

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Sites & Machines ───
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  timezone TEXT DEFAULT 'Africa/Johannesburg',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT,
  start_hour_meter NUMERIC DEFAULT 0,
  billable_rate NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Machine runtime lock (server-authoritative when online)
CREATE TABLE IF NOT EXISTS machine_runtime (
  machine_id TEXT PRIMARY KEY REFERENCES machines(id),
  is_running BOOLEAN DEFAULT false,
  shift_id TEXT,
  operator_id UUID,
  operator_name TEXT,
  started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Profiles ───
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('operator','mechanic','supervisor','manager','admin')),
  site_id UUID REFERENCES sites(id),
  machine_id TEXT REFERENCES machines(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Operational tables (create if missing, extend if exists) ───
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  machine_id TEXT REFERENCES machines(id),
  operator_id UUID,
  operator_name TEXT,
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
  notes TEXT,
  is_manual BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  shift_id TEXT,
  machine_id TEXT,
  operator_id UUID,
  operator_name TEXT,
  type TEXT NOT NULL,
  reason TEXT,
  note TEXT,
  stopped_at TIMESTAMPTZ,
  restarted_at TIMESTAMPTZ,
  downtime_minutes NUMERIC,
  status TEXT,
  photo_ref TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_sessions (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  machine_id TEXT,
  operator_id UUID,
  operator_name TEXT,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  notes TEXT,
  supervisor_signature_ref TEXT,
  signature_name TEXT,
  signature_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fuel_logs (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  machine_id TEXT,
  shift_id TEXT,
  operator_id UUID,
  operator_name TEXT,
  litres NUMERIC,
  hour_meter NUMERIC,
  tank_level TEXT,
  photo_pump_ref TEXT,
  photo_dipstick_ref TEXT,
  note TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  machine_id TEXT,
  operator_id UUID,
  operator_name TEXT,
  category TEXT,
  amount NUMERIC,
  vendor TEXT,
  description TEXT,
  receipt_ref TEXT,
  date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  machine_id TEXT,
  operator_id UUID,
  operator_name TEXT,
  type TEXT,
  category TEXT,
  item_name TEXT,
  status TEXT,
  photo_ref TEXT,
  remark TEXT,
  inspection_id TEXT,
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issues (
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

CREATE TABLE IF NOT EXISTS issue_messages (
  id TEXT PRIMARY KEY,
  issue_id TEXT REFERENCES issues(id) ON DELETE CASCADE,
  sender_id UUID,
  sender_name TEXT,
  sender_role TEXT,
  type TEXT,
  text TEXT,
  media_ref TEXT,
  media_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shift_submissions (
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

CREATE TABLE IF NOT EXISTS shift_corrections (
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

CREATE TABLE IF NOT EXISTS machine_hour_readings (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  machine_id TEXT,
  operator_id UUID,
  operator_name TEXT,
  reading NUMERIC NOT NULL,
  photo_ref TEXT,
  reading_at TIMESTAMPTZ NOT NULL,
  source TEXT DEFAULT 'manual',
  shift_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS breakdowns (
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

CREATE TABLE IF NOT EXISTS maintenance_jobs (
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

CREATE TABLE IF NOT EXISTS maintenance_parts (
  id TEXT PRIMARY KEY,
  maintenance_job_id TEXT REFERENCES maintenance_jobs(id) ON DELETE CASCADE,
  inventory_item_id TEXT,
  part_name TEXT,
  quantity NUMERIC DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_items (
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

CREATE TABLE IF NOT EXISTS inventory_movements (
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

-- Audit log (append-only)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for sync watermarks
CREATE INDEX IF NOT EXISTS idx_shifts_updated ON shifts(updated_at);
CREATE INDEX IF NOT EXISTS idx_events_updated ON events(updated_at);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_updated ON fuel_logs(updated_at);
CREATE INDEX IF NOT EXISTS idx_issues_updated ON issues(updated_at);
CREATE INDEX IF NOT EXISTS idx_breakdowns_updated ON breakdowns(updated_at);
CREATE INDEX IF NOT EXISTS idx_maintenance_jobs_updated ON maintenance_jobs(updated_at);
CREATE INDEX IF NOT EXISTS idx_machine_hour_readings_reading_at ON machine_hour_readings(reading_at);

-- ─── updated_at trigger ───
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY['sites','machines','profiles','shifts','events','work_sessions','fuel_logs','expenses','inspections','issues','shift_submissions','machine_hour_readings','breakdowns','maintenance_jobs','inventory_items'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

-- ─── Audit trigger ───
CREATE OR REPLACE FUNCTION audit_row_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY['shifts','expenses','fuel_logs','machine_hour_readings','inventory_items','inventory_movements'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%s ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_row_change()', t, t);
  END LOOP;
END $$;

-- ─── Machine lock RPCs ───
CREATE OR REPLACE FUNCTION start_machine(p_machine_id TEXT, p_shift_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE v_running BOOLEAN;
BEGIN
  SELECT is_running INTO v_running FROM machine_runtime WHERE machine_id = p_machine_id FOR UPDATE;
  IF v_running IS TRUE THEN RETURN false; END IF;
  INSERT INTO machine_runtime (machine_id, is_running, shift_id, operator_id, operator_name, started_at, updated_at)
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
  UPDATE machine_runtime SET is_running = false, updated_at = now() WHERE machine_id = p_machine_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Shift verification RPC ───
CREATE OR REPLACE FUNCTION verify_shift(p_shift_id TEXT, p_verification_token TEXT, p_action TEXT, p_reason TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE v_shift shifts%ROWTYPE;
BEGIN
  SELECT * INTO v_shift FROM shifts WHERE id = p_shift_id AND verification_token = p_verification_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid shift or token'; END IF;

  IF p_action = 'verify' THEN
    UPDATE shifts SET shift_status = 'VERIFIED', verified_at = now(), verified_by = auth.uid(), verification_token = NULL, updated_at = now() WHERE id = p_shift_id;
  ELSIF p_action = 'correct' THEN
    UPDATE shifts SET shift_status = 'CORRECTION_REQUIRED', supervisor_comment = p_reason, verification_token = NULL, updated_at = now() WHERE id = p_shift_id;
  ELSIF p_action = 'escalate' THEN
    UPDATE shifts SET shift_status = 'CORRECTION_REQUIRED', supervisor_comment = COALESCE(p_reason, 'Escalated'), verification_token = NULL, updated_at = now() WHERE id = p_shift_id;
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── RLS helper ───
CREATE OR REPLACE FUNCTION user_site_id()
RETURNS UUID AS $$
  SELECT site_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable RLS
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_hour_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE breakdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Profiles: read own + admins read all at site
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  id = auth.uid() OR user_role() IN ('admin','manager') OR site_id = user_site_id()
);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (user_role() = 'admin');

-- Site-scoped read for operational data
CREATE POLICY site_read_shifts ON shifts FOR SELECT USING (site_id = user_site_id() OR user_role() IN ('admin','manager'));
CREATE POLICY site_write_shifts ON shifts FOR ALL USING (site_id = user_site_id() OR user_role() IN ('admin','supervisor','operator'));

CREATE POLICY site_read_events ON events FOR SELECT USING (site_id = user_site_id() OR user_role() IN ('admin','manager','supervisor'));
CREATE POLICY site_write_events ON events FOR ALL USING (site_id = user_site_id() OR user_role() IN ('admin','supervisor','operator'));

CREATE POLICY site_read_fuel ON fuel_logs FOR SELECT USING (site_id = user_site_id() OR user_role() IN ('admin','manager'));
CREATE POLICY site_write_fuel ON fuel_logs FOR ALL USING (site_id = user_site_id() OR user_role() IN ('admin','supervisor','operator'));

CREATE POLICY site_read_issues ON issues FOR SELECT USING (site_id = user_site_id() OR user_role() IN ('admin','manager','supervisor','mechanic'));
CREATE POLICY site_write_issues ON issues FOR ALL USING (site_id = user_site_id() OR user_role() IN ('admin','supervisor','operator','mechanic'));

CREATE POLICY site_read_breakdowns ON breakdowns FOR SELECT USING (site_id = user_site_id() OR user_role() IN ('admin','manager','supervisor','mechanic'));
CREATE POLICY site_write_breakdowns ON breakdowns FOR ALL USING (
  site_id = user_site_id() AND user_role() IN ('admin','supervisor','mechanic','operator')
);

CREATE POLICY site_read_maintenance ON maintenance_jobs FOR SELECT USING (site_id = user_site_id() OR user_role() IN ('admin','manager','supervisor','mechanic'));
CREATE POLICY site_write_maintenance ON maintenance_jobs FOR ALL USING (
  site_id = user_site_id() AND user_role() IN ('admin','mechanic')
);

CREATE POLICY admin_audit ON audit_log FOR SELECT USING (user_role() IN ('admin','manager'));

-- Storage bucket (run separately if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('ops-media', 'ops-media', true) ON CONFLICT DO NOTHING;

-- Seed default site + machine
INSERT INTO sites (id, name, code) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Malekaskraal', 'MLK')
ON CONFLICT (code) DO NOTHING;

INSERT INTO machines (id, site_id, name, code, type, start_hour_meter, billable_rate) VALUES
  ('W2100-001', '00000000-0000-0000-0000-000000000001', 'Powerscreen Warrior 2100', 'W2100', 'Screen', 5032, 1800)
ON CONFLICT (id) DO NOTHING;
