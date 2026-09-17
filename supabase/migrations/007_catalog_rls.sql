-- Allow admin/manager to manage sites, machines, and parts catalog.
-- All authenticated users can read sites/machines; site-scoped inventory read.

DROP POLICY IF EXISTS sites_read ON sites;
CREATE POLICY sites_read ON sites
  FOR SELECT TO authenticated USING (true);

CREATE POLICY sites_admin_write ON sites
  FOR ALL TO authenticated
  USING (user_role() IN ('admin', 'manager'))
  WITH CHECK (user_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS machines_read ON machines;
CREATE POLICY machines_read ON machines
  FOR SELECT TO authenticated USING (true);

CREATE POLICY machines_admin_write ON machines
  FOR ALL TO authenticated
  USING (user_role() IN ('admin', 'manager'))
  WITH CHECK (user_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS inventory_items_read ON inventory_items;
CREATE POLICY inventory_items_read ON inventory_items
  FOR SELECT TO authenticated
  USING (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'mechanic', 'operator')
  );

DROP POLICY IF EXISTS inventory_items_write ON inventory_items;
CREATE POLICY inventory_items_write ON inventory_items
  FOR ALL TO authenticated
  USING (
    user_role() IN ('admin', 'manager')
    AND (user_role() = 'admin' OR site_id = user_site_id())
  )
  WITH CHECK (
    user_role() IN ('admin', 'manager')
    AND (user_role() = 'admin' OR site_id = user_site_id())
  );
