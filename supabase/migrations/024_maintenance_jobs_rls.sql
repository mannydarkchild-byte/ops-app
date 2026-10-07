-- Supervisors create a maintenance job when they send a problem to a mechanic.
-- The old write policy only allowed admin and mechanic, so that insert failed
-- with "new row violates row-level security policy". Some databases also had
-- RLS enabled and no policy at all.

DROP POLICY IF EXISTS site_read_maintenance ON maintenance_jobs;
DROP POLICY IF EXISTS site_write_maintenance ON maintenance_jobs;
DROP POLICY IF EXISTS maintenance_jobs_read ON maintenance_jobs;
DROP POLICY IF EXISTS maintenance_jobs_write ON maintenance_jobs;

CREATE POLICY maintenance_jobs_read ON maintenance_jobs
  FOR SELECT TO authenticated
  USING (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'mechanic')
  );

CREATE POLICY maintenance_jobs_write ON maintenance_jobs
  FOR ALL TO authenticated
  USING (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'mechanic')
  )
  WITH CHECK (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'mechanic')
  );
