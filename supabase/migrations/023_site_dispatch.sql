-- One weighbridge entry per site per calendar day. Not stored on each machine sign-off.
CREATE TABLE IF NOT EXISTS site_dispatch (
  id TEXT PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  dispatch_date DATE NOT NULL,
  tonnes_dispatched NUMERIC,
  trucks_dispatched INTEGER,
  tonnes_on_floor NUMERIC,
  weighbridge_photo TEXT,
  recorded_by UUID,
  recorded_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (site_id, dispatch_date)
);

ALTER TABLE site_dispatch ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_dispatch_all ON site_dispatch;
CREATE POLICY site_dispatch_all ON site_dispatch
  FOR ALL TO authenticated
  USING (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor')
  )
  WITH CHECK (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor')
  );
