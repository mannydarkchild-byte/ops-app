-- Second pre-start list for excavators and front end loaders.
-- The screen list stays in prestart_items. Admin edits both.
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS earthmoving_prestart_items JSONB;
