-- Per-site configuration: billing cycle, primary machine, editable checklists
CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY,
  site_id UUID NOT NULL UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
  billing_cycle_start_day INT NOT NULL DEFAULT 26 CHECK (billing_cycle_start_day BETWEEN 1 AND 28),
  primary_machine_id TEXT REFERENCES machines(id),
  prestart_items JSONB,
  prestart_status_options JSONB,
  inspection_groups JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_settings_site ON site_settings(site_id);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_settings_read" ON site_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "site_settings_write" ON site_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
