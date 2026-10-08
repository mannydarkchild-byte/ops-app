-- Both tables had row-level security on, and the write rules blocked the people
-- who actually save a repair. Supervisors create the breakdown and the job.
-- Mechanics update them. The old maintenance rule allowed only admin and mechanic.
-- The old breakdown rule also required the row site to match the profile site.
-- Some databases enabled the lock and never added a rule, which rejects every write.
-- This drops every existing policy on both tables, then allows the site roles.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.breakdowns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_jobs TO authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('breakdowns', 'maintenance_jobs')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY breakdowns_all ON public.breakdowns
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(p.role)) IN ('admin', 'manager', 'supervisor', 'mechanic', 'operator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(p.role)) IN ('admin', 'manager', 'supervisor', 'mechanic', 'operator')
    )
  );

CREATE POLICY maintenance_jobs_all ON public.maintenance_jobs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(p.role)) IN ('admin', 'manager', 'supervisor', 'mechanic', 'operator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(p.role)) IN ('admin', 'manager', 'supervisor', 'mechanic', 'operator')
    )
  );
