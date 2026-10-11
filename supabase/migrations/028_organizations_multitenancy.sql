-- ==============================================================================
-- OPS Multi-Tenancy & Organizations Migration
-- Migration: 028_organizations_multitenancy.sql
--
-- Safely transitions single-tenant OPS into a multi-tenant B2B SaaS platform.
-- Preserves all existing sites, machines, shifts, and user records under a
-- default organization ('00000000-0000-0000-0000-000000000001').
-- ==============================================================================

-- 1. Create the organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'professional' CHECK (plan IN ('starter', 'professional', 'enterprise')),
  currency TEXT DEFAULT 'ZAR' CHECK (currency IN ('ZAR', 'USD', 'AUD', 'EUR', 'GBP')),
  logo_url TEXT,
  billing_status TEXT DEFAULT 'active' CHECK (billing_status IN ('trial', 'active', 'past_due', 'canceled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create the default organization for existing data (idempotent)
INSERT INTO public.organizations (id, name, slug, plan, currency, billing_status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Primary Operations',
  'default',
  'professional',
  'ZAR',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Add organization_id column to core and operational tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.work_sessions ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.shift_submissions ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.fuel_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.machine_hour_readings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.breakdowns ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.maintenance_jobs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.site_dispatch ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 4. Add dynamic stop-owner fields to site_settings if not present
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS contractor_name TEXT DEFAULT 'Darkchild';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS equipment_owner_name TEXT DEFAULT 'Berlington';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS client_site_name TEXT DEFAULT 'Site / operations';

-- 5. Backfill existing records with the default organization ID
UPDATE public.sites SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.profiles SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.machines SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.shifts SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.events SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.expenses SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.inspections SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.issues SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.work_sessions SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.shift_submissions SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.fuel_logs SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.machine_hour_readings SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.breakdowns SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.maintenance_jobs SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.inventory_items SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.site_settings SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.site_dispatch SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- 6. Helper function to look up current user's organization_id
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO authenticated, service_role;

-- 7. Update handle_new_user() trigger to attach user to organization
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_site_id UUID;
  v_machine_id TEXT;
  v_role TEXT;
  v_name TEXT;
BEGIN
  v_role := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'role'), ''), 'operator');
  IF v_role NOT IN ('operator', 'mechanic', 'supervisor', 'manager', 'admin', 'dispatch', 'storeroom') THEN
    v_role := 'operator';
  END IF;

  v_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'User'
  );

  -- Determine organization from user metadata or fallback to default
  IF NEW.raw_user_meta_data->>'organization_id' IS NOT NULL THEN
    v_org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;
  ELSE
    SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at LIMIT 1;
  END IF;

  -- Pick default site within that organization
  SELECT id INTO v_site_id FROM public.sites
  WHERE organization_id = v_org_id AND active IS NOT FALSE
  ORDER BY created_at LIMIT 1;

  IF v_role = 'operator' AND v_site_id IS NOT NULL THEN
    SELECT id INTO v_machine_id FROM public.machines
    WHERE site_id = v_site_id AND active IS NOT FALSE
    ORDER BY created_at LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, name, role, site_id, machine_id, organization_id)
  VALUES (NEW.id, NEW.email, v_name, v_role, v_site_id, v_machine_id, v_org_id);

  RETURN NEW;
END;
$$;

-- 8. Enable Row Level Security (RLS) on organizations table
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_read ON public.organizations;
CREATE POLICY organizations_read ON public.organizations
  FOR SELECT TO authenticated
  USING (id = current_user_org_id());

DROP POLICY IF EXISTS organizations_update ON public.organizations;
CREATE POLICY organizations_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = current_user_org_id() AND user_role() IN ('admin', 'manager'));

-- 9. Secure Sites table by organization
DROP POLICY IF EXISTS sites_select ON public.sites;
CREATE POLICY sites_select ON public.sites
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR organization_id = current_user_org_id());

DROP POLICY IF EXISTS sites_write ON public.sites;
CREATE POLICY sites_write ON public.sites
  FOR ALL TO authenticated
  USING (user_role() IN ('admin', 'manager') AND (organization_id IS NULL OR organization_id = current_user_org_id()))
  WITH CHECK (user_role() IN ('admin', 'manager') AND (organization_id IS NULL OR organization_id = current_user_org_id()));

-- 10. Secure Machines table by organization
DROP POLICY IF EXISTS machines_select ON public.machines;
CREATE POLICY machines_select ON public.machines
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR organization_id = current_user_org_id());

DROP POLICY IF EXISTS machines_write ON public.machines;
CREATE POLICY machines_write ON public.machines
  FOR ALL TO authenticated
  USING (user_role() IN ('admin', 'manager') AND (organization_id IS NULL OR organization_id = current_user_org_id()))
  WITH CHECK (user_role() IN ('admin', 'manager') AND (organization_id IS NULL OR organization_id = current_user_org_id()));

-- 11. Secure Profiles table by organization
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (organization_id = current_user_org_id())
  );
