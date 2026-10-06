-- Mechanic inspection list for excavators and front end loaders.
-- The screen list stays in inspection_groups. Admin edits both.
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS earthmoving_inspection_groups JSONB;
