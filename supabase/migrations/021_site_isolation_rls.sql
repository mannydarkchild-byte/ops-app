-- Real site isolation for operational data.
-- Product intent (matches ManagerApp/AdminApp UI):
--   * admin  → cross-site read/write
--   * manager, supervisor, operator, mechanic → only their profile site_id
-- Does not rewrite prior migrations; replaces live policies.

CREATE OR REPLACE FUNCTION public.can_access_site(p_site_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(user_role() = 'admin', false)
    OR (p_site_id IS NOT NULL AND p_site_id = user_site_id());
$$;

GRANT EXECUTE ON FUNCTION public.can_access_site(UUID) TO authenticated, anon, service_role;

-- ─── Helper: drop + recreate FOR ALL site-scoped policy ───
-- shifts
DROP POLICY IF EXISTS shifts_all ON shifts;
DROP POLICY IF EXISTS site_read_shifts ON shifts;
DROP POLICY IF EXISTS site_write_shifts ON shifts;
CREATE POLICY shifts_site ON shifts
  FOR ALL TO authenticated
  USING (can_access_site(site_id))
  WITH CHECK (can_access_site(site_id));

-- events
DROP POLICY IF EXISTS events_all ON events;
DROP POLICY IF EXISTS site_read_events ON events;
DROP POLICY IF EXISTS site_write_events ON events;
CREATE POLICY events_site ON events
  FOR ALL TO authenticated
  USING (can_access_site(site_id))
  WITH CHECK (can_access_site(site_id));

-- inspections
DROP POLICY IF EXISTS inspections_all ON inspections;
DROP POLICY IF EXISTS inspections_read ON inspections;
DROP POLICY IF EXISTS inspections_write ON inspections;
CREATE POLICY inspections_site ON inspections
  FOR ALL TO authenticated
  USING (can_access_site(site_id))
  WITH CHECK (can_access_site(site_id));

-- fuel_logs
DROP POLICY IF EXISTS fuel_logs_all ON fuel_logs;
DROP POLICY IF EXISTS site_read_fuel ON fuel_logs;
DROP POLICY IF EXISTS site_write_fuel ON fuel_logs;
CREATE POLICY fuel_logs_site ON fuel_logs
  FOR ALL TO authenticated
  USING (can_access_site(site_id))
  WITH CHECK (can_access_site(site_id));

-- work_sessions
DROP POLICY IF EXISTS work_sessions_all ON work_sessions;
CREATE POLICY work_sessions_site ON work_sessions
  FOR ALL TO authenticated
  USING (can_access_site(site_id))
  WITH CHECK (can_access_site(site_id));

-- expenses
DROP POLICY IF EXISTS expenses_all ON expenses;
CREATE POLICY expenses_site ON expenses
  FOR ALL TO authenticated
  USING (can_access_site(site_id))
  WITH CHECK (can_access_site(site_id));

-- shift_submissions
DROP POLICY IF EXISTS shift_submissions_all ON shift_submissions;
CREATE POLICY shift_submissions_site ON shift_submissions
  FOR ALL TO authenticated
  USING (can_access_site(site_id))
  WITH CHECK (can_access_site(site_id));

-- machine_hour_readings
DROP POLICY IF EXISTS machine_hour_readings_all ON machine_hour_readings;
CREATE POLICY machine_hour_readings_site ON machine_hour_readings
  FOR ALL TO authenticated
  USING (can_access_site(site_id))
  WITH CHECK (can_access_site(site_id));

-- issues
DROP POLICY IF EXISTS issues_all ON issues;
DROP POLICY IF EXISTS site_read_issues ON issues;
DROP POLICY IF EXISTS site_write_issues ON issues;
CREATE POLICY issues_site ON issues
  FOR ALL TO authenticated
  USING (can_access_site(site_id))
  WITH CHECK (can_access_site(site_id));

-- issue_messages (via parent issue site)
DROP POLICY IF EXISTS issue_messages_all ON issue_messages;
CREATE POLICY issue_messages_site ON issue_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM issues i
      WHERE i.id = issue_messages.issue_id
        AND can_access_site(i.site_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM issues i
      WHERE i.id = issue_messages.issue_id
        AND can_access_site(i.site_id)
    )
  );

-- breakdowns
DROP POLICY IF EXISTS site_read_breakdowns ON breakdowns;
DROP POLICY IF EXISTS site_write_breakdowns ON breakdowns;
DROP POLICY IF EXISTS breakdowns_all ON breakdowns;
CREATE POLICY breakdowns_site ON breakdowns
  FOR ALL TO authenticated
  USING (can_access_site(site_id))
  WITH CHECK (can_access_site(site_id));

-- maintenance_jobs
DROP POLICY IF EXISTS site_read_maintenance ON maintenance_jobs;
DROP POLICY IF EXISTS site_write_maintenance ON maintenance_jobs;
DROP POLICY IF EXISTS maintenance_jobs_all ON maintenance_jobs;
CREATE POLICY maintenance_jobs_site ON maintenance_jobs
  FOR ALL TO authenticated
  USING (can_access_site(site_id))
  WITH CHECK (can_access_site(site_id));

-- maintenance_parts (via job) — table may be absent on older projects
DO $$
BEGIN
  IF to_regclass('public.maintenance_parts') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE maintenance_parts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS maintenance_parts_all ON maintenance_parts;
  DROP POLICY IF EXISTS maintenance_parts_site ON maintenance_parts;
  CREATE POLICY maintenance_parts_site ON maintenance_parts
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM maintenance_jobs j
        WHERE j.id = maintenance_parts.maintenance_job_id
          AND can_access_site(j.site_id)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM maintenance_jobs j
        WHERE j.id = maintenance_parts.maintenance_job_id
          AND can_access_site(j.site_id)
      )
    );
END $$;

-- shift_corrections (via shift)
DO $$
BEGIN
  IF to_regclass('public.shift_corrections') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE shift_corrections ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS shift_corrections_all ON shift_corrections;
  DROP POLICY IF EXISTS shift_corrections_site ON shift_corrections;
  CREATE POLICY shift_corrections_site ON shift_corrections
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM shifts s
        WHERE s.id = shift_corrections.shift_id
          AND can_access_site(s.site_id)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM shifts s
        WHERE s.id = shift_corrections.shift_id
          AND can_access_site(s.site_id)
      )
    );
END $$;

-- inventory_items
DROP POLICY IF EXISTS inventory_items_read ON inventory_items;
DROP POLICY IF EXISTS inventory_items_write ON inventory_items;
CREATE POLICY inventory_items_site ON inventory_items
  FOR ALL TO authenticated
  USING (can_access_site(site_id))
  WITH CHECK (
    can_access_site(site_id)
    AND user_role() IN ('admin', 'manager')
  );

-- inventory_movements
DO $$
BEGIN
  IF to_regclass('public.inventory_movements') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS inventory_movements_all ON inventory_movements;
  DROP POLICY IF EXISTS inventory_movements_site ON inventory_movements;
  CREATE POLICY inventory_movements_site ON inventory_movements
    FOR ALL TO authenticated
    USING (can_access_site(site_id))
    WITH CHECK (
      can_access_site(site_id)
      AND user_role() IN ('admin', 'manager', 'mechanic', 'supervisor')
    );
END $$;

-- site_settings: managers only their site; admins all
DROP POLICY IF EXISTS "site_settings_read" ON site_settings;
DROP POLICY IF EXISTS site_settings_read ON site_settings;
DROP POLICY IF EXISTS "site_settings_write" ON site_settings;
DROP POLICY IF EXISTS site_settings_write ON site_settings;

CREATE POLICY site_settings_read ON site_settings
  FOR SELECT TO authenticated
  USING (can_access_site(site_id));

CREATE POLICY site_settings_write ON site_settings
  FOR ALL TO authenticated
  USING (
    user_role() = 'admin'
    OR (user_role() = 'manager' AND site_id = user_site_id())
  )
  WITH CHECK (
    user_role() = 'admin'
    OR (user_role() = 'manager' AND site_id = user_site_id())
  );

-- sites / machines catalog: own site (admin: all)
DROP POLICY IF EXISTS sites_read ON sites;
CREATE POLICY sites_read ON sites
  FOR SELECT TO authenticated
  USING (user_role() = 'admin' OR id = user_site_id());

DROP POLICY IF EXISTS sites_admin_write ON sites;
CREATE POLICY sites_admin_write ON sites
  FOR ALL TO authenticated
  USING (user_role() = 'admin')
  WITH CHECK (user_role() = 'admin');

DROP POLICY IF EXISTS machines_read ON machines;
CREATE POLICY machines_read ON machines
  FOR SELECT TO authenticated
  USING (can_access_site(site_id));

DROP POLICY IF EXISTS machines_admin_write ON machines;
CREATE POLICY machines_admin_write ON machines
  FOR ALL TO authenticated
  USING (
    user_role() = 'admin'
    OR (user_role() = 'manager' AND site_id = user_site_id())
  )
  WITH CHECK (
    user_role() = 'admin'
    OR (user_role() = 'manager' AND site_id = user_site_id())
  );

-- profiles: own row, same site, or admin (managers no longer see every site)
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR user_role() = 'admin'
    OR site_id = user_site_id()
  );

-- machine_status: via machine's site (writes go through SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS machine_status_read ON machine_status;
CREATE POLICY machine_status_read ON machine_status
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM machines m
      WHERE m.id = machine_status.machine_id
        AND can_access_site(m.site_id)
    )
  );
