-- Editable stop reasons + owners for downtime accountability (Pulse + daily reports)
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS stop_reasons JSONB;
