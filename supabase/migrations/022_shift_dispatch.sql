-- Weighbridge dispatch and a supervisor estimate of tonnes still on the floor, recorded on the shift.
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS tonnes_dispatched NUMERIC;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS trucks_dispatched INTEGER;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS tonnes_on_floor NUMERIC;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS weighbridge_photo TEXT;
