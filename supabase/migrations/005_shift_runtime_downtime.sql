-- App-tracked runtime & downtime (separate from meter-based hours_worked)
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS runtime_minutes NUMERIC DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS downtime_minutes NUMERIC DEFAULT 0;
