-- shift_submissions: ensure operators can insert their own submissions (site_id + role)

DROP POLICY IF EXISTS shift_submissions_all ON shift_submissions;

CREATE POLICY shift_submissions_all ON shift_submissions
  FOR ALL TO authenticated
  USING (
    site_id = user_site_id()
    OR operator_id = auth.uid()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'operator')
  )
  WITH CHECK (
    site_id = user_site_id()
    OR operator_id = auth.uid()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'operator')
  );

ALTER TABLE events ADD COLUMN IF NOT EXISTS photo_data TEXT;
