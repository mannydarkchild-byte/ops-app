-- A manager can sign an operator's daily report without switching to the supervisor role.
DROP POLICY IF EXISTS site_write_shifts ON shifts;

CREATE POLICY site_write_shifts ON shifts
  FOR ALL TO authenticated
  USING (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'operator')
  )
  WITH CHECK (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'operator')
  );
