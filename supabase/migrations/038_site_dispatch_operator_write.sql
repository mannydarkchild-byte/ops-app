-- Operators now enter today's tonnes on Finish shift.
-- site_dispatch write was limited to admin / manager / supervisor / dispatch.

DROP POLICY IF EXISTS site_dispatch_write ON public.site_dispatch;

CREATE POLICY site_dispatch_write ON public.site_dispatch
  FOR ALL TO authenticated
  USING (
    user_role() IN ('admin', 'manager', 'supervisor', 'dispatch', 'operator')
    AND (site_id = user_site_id() OR user_role() IN ('admin', 'manager'))
  )
  WITH CHECK (
    user_role() IN ('admin', 'manager', 'supervisor', 'dispatch', 'operator')
    AND (site_id = user_site_id() OR user_role() IN ('admin', 'manager'))
  );
