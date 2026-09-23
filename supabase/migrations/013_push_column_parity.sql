-- Optional: add *_ref columns for newer app builds (push uses URL columns only)

ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS photo_pump_ref TEXT;
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS photo_dipstick_ref TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_ref TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS photo_ref TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS photo_ref TEXT;
ALTER TABLE machine_hour_readings ADD COLUMN IF NOT EXISTS photo_ref TEXT;
