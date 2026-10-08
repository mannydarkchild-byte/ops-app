-- Storeroom login receives, adjusts, and issues tools and parts.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'profiles'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('operator', 'mechanic', 'supervisor', 'manager', 'admin', 'dispatch', 'storeroom'));

DROP POLICY IF EXISTS inventory_items_read ON inventory_items;
CREATE POLICY inventory_items_read ON inventory_items
  FOR SELECT TO authenticated
  USING (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'supervisor', 'mechanic', 'operator', 'storeroom', 'dispatch')
  );

DROP POLICY IF EXISTS inventory_items_write ON inventory_items;
CREATE POLICY inventory_items_write ON inventory_items
  FOR ALL TO authenticated
  USING (
    user_role() IN ('admin', 'manager', 'storeroom')
    AND (user_role() = 'admin' OR site_id = user_site_id())
  )
  WITH CHECK (
    user_role() IN ('admin', 'manager', 'storeroom')
    AND (user_role() = 'admin' OR site_id = user_site_id())
  );

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_movements_read ON inventory_movements;
CREATE POLICY inventory_movements_read ON inventory_movements
  FOR SELECT TO authenticated
  USING (
    site_id = user_site_id()
    OR user_role() IN ('admin', 'manager', 'storeroom')
  );

DROP POLICY IF EXISTS inventory_movements_write ON inventory_movements;
CREATE POLICY inventory_movements_write ON inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    user_role() IN ('admin', 'manager', 'storeroom')
    AND (user_role() = 'admin' OR site_id = user_site_id())
  );
