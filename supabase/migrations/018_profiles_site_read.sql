-- Operators must read the crew on their site, or the clock-in supervisor list stays empty.
-- Migration 002 replaced the site read with "own row, or admin/manager", so a phone
-- never received other supervisors. Same-site profiles are visible again.
-- user_role() and user_site_id() are SECURITY DEFINER, so this does not recurse.

DROP POLICY IF EXISTS profiles_select ON profiles;

CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR user_role() IN ('admin', 'manager')
    OR site_id = user_site_id()
  );
