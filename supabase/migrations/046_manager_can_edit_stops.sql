-- A manager can correct a stop reason and its hours without switching role.
DROP POLICY IF EXISTS site_write_events ON events;

CREATE POLICY site_write_events ON events
  FOR ALL TO authenticated
  USING (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'operator')
  )
  WITH CHECK (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'operator')
  );
