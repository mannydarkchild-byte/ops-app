-- Operators can insert their own sign-off row.
-- Matches migration 014, reapplied so a missing or older policy cannot block submit.
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
