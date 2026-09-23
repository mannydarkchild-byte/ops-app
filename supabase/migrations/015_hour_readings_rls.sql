-- Operators can save opening and closing hour meter readings

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
