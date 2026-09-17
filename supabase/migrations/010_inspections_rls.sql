-- Inspections (and related tables) had RLS enabled but no policies — sync inserts were silently blocked.
-- Run in Supabase SQL editor, then tap Sync in the app to push queued local rows.

-- Schema columns the app expects
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS photo_ref TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill photo_ref from legacy photo column when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inspections' AND column_name = 'photo'
  ) THEN
    UPDATE inspections
    SET photo_ref = COALESCE(photo_ref, photo)
    WHERE photo_ref IS NULL AND photo IS NOT NULL;
  END IF;
END $$;

-- ─── Inspections ───
DROP POLICY IF EXISTS inspections_all ON inspections;
DROP POLICY IF EXISTS inspections_read ON inspections;
DROP POLICY IF EXISTS inspections_write ON inspections;

CREATE POLICY inspections_read ON inspections
  FOR SELECT TO authenticated
  USING (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'operator', 'mechanic')
  );

CREATE POLICY inspections_write ON inspections
  FOR ALL TO authenticated
  USING (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'operator', 'mechanic')
  )
  WITH CHECK (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'operator', 'mechanic')
  );

-- ─── Other tables that often had RLS on with no policy (blocks sync) ───

DROP POLICY IF EXISTS work_sessions_all ON work_sessions;
CREATE POLICY work_sessions_all ON work_sessions
  FOR ALL TO authenticated
  USING (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'operator')
  )
  WITH CHECK (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'operator')
  );

DROP POLICY IF EXISTS expenses_all ON expenses;
CREATE POLICY expenses_all ON expenses
  FOR ALL TO authenticated
  USING (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'operator')
  )
  WITH CHECK (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'operator')
  );

DROP POLICY IF EXISTS shift_submissions_all ON shift_submissions;
CREATE POLICY shift_submissions_all ON shift_submissions
  FOR ALL TO authenticated
  USING (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'operator')
  )
  WITH CHECK (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'operator')
  );

DROP POLICY IF EXISTS machine_hour_readings_all ON machine_hour_readings;
CREATE POLICY machine_hour_readings_all ON machine_hour_readings
  FOR ALL TO authenticated
  USING (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'operator')
  )
  WITH CHECK (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'operator')
  );

DROP POLICY IF EXISTS issue_messages_all ON issue_messages;
CREATE POLICY issue_messages_all ON issue_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM issues i
      WHERE i.id = issue_messages.issue_id
        AND (
          i.site_id = user_site_id()
          OR user_role() IN ('admin', 'manager', 'supervisor', 'operator', 'mechanic')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM issues i
      WHERE i.id = issue_messages.issue_id
        AND (
          i.site_id = user_site_id()
          OR user_role() IN ('admin', 'manager', 'supervisor', 'operator', 'mechanic')
        )
    )
  );
