-- Multiple supervisors per site — assign per machine shift
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS assigned_supervisor_id UUID REFERENCES profiles(id);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS assigned_supervisor_name TEXT;

-- Optional: day / night / any — helps pre-select the right supervisor
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shift_band TEXT DEFAULT 'any'
  CHECK (shift_band IN ('day', 'night', 'any'));
