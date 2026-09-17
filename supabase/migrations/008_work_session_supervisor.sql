-- Supervisor assigned when operator clocks in (not only at end of shift)
ALTER TABLE work_sessions ADD COLUMN IF NOT EXISTS assigned_supervisor_id UUID REFERENCES profiles(id);
ALTER TABLE work_sessions ADD COLUMN IF NOT EXISTS assigned_supervisor_name TEXT;
