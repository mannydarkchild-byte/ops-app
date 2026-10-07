-- Weighbridge v1: supervisor shift tonnage + trucks loaded (site-scoped)

CREATE TABLE IF NOT EXISTS shift_tonnages (
  id TEXT PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  shift_date DATE NOT NULL,
  shift_band TEXT NOT NULL DEFAULT 'day'
    CHECK (shift_band IN ('day', 'night')),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  total_tonnes NUMERIC(12, 2) NOT NULL CHECK (total_tonnes >= 0),
  trucks_loaded INT NOT NULL DEFAULT 0 CHECK (trucks_loaded >= 0),
  photo_url TEXT,
  submitted_by UUID REFERENCES profiles(id),
  submitted_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_tonnages_site_date
  ON shift_tonnages (site_id, shift_date DESC);

CREATE INDEX IF NOT EXISTS idx_shift_tonnages_updated
  ON shift_tonnages (updated_at);

ALTER TABLE shift_tonnages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shift_tonnages_all ON shift_tonnages;

-- Site isolation consistent with fuel_logs / expenses style policies on main.
-- Supervisors and managers on the site can read/write; admins retain access.
CREATE POLICY shift_tonnages_all ON shift_tonnages
  FOR ALL TO authenticated
  USING (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor')
  )
  WITH CHECK (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor')
  );
