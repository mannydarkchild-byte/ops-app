# OPS TECHNICAL SAAS ROADMAP & MULTI-TENANCY GUIDE
## Transitioning from a Pilot/Single-Fleet Tool to a Commercial B2B SaaS

This document outlines the technical steps required to scale **OPS** from a dedicated fleet operations application into a multi-tenant B2B SaaS product capable of serving hundreds of independent plant hire and mining contracting companies.

---

## 1. Multi-Tenancy Architecture (Tenant Isolation)

Currently, the app manages sites, machines, and shifts under a single Supabase backend. To sell this to multiple independent companies, strict **tenant isolation** is required so Company A cannot view or access Company B's machines, rates, or shifts.

### Step 1: Add `organizations` Table in Supabase

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text default 'professional', -- starter | professional | enterprise
  currency text default 'ZAR',      -- ZAR | USD | AUD | EUR
  logo_url text,
  billing_status text default 'active', -- trial | active | past_due | canceled
  created_at timestamptz default now()
);
```

### Step 2: Add `organization_id` to All Key Tables

Add `organization_id uuid references organizations(id) on delete cascade` to:
- `profiles`
- `sites`
- `machines`
- `shifts`
- `events`
- `inspections`
- `issues`
- `fuel_logs`
- `maintenance_jobs`
- `inventory_items`
- `expenses`
- `site_settings`

### Step 3: Implement Supabase Row Level Security (RLS)

Enable RLS on all tables to ensure users only read and write data belonging to their own organization:

```sql
-- Helper function to get current user's organization_id
create or replace function get_current_org_id()
returns uuid language sql stable as $$
  select organization_id from profiles where id = auth.uid() limit 1;
$$;

-- Example: Secure shifts table
alter table shifts enable row level security;

create policy "Users can only access their organization's shifts"
  on shifts for all
  using (organization_id = get_current_org_id())
  with check (organization_id = get_current_org_id());
```

---

## 2. Decoupling Hardcoded Names into Dynamic Stop Owner Entities

In the current prototype, certain constants reference `"Darkchild"` (Contractor) and `"Berlington"` (Hire company/wear). For commercial multi-tenant packaging, these must be fully dynamic per customer.

### Current Architecture:
In `src/lib/constants.js`:
```javascript
export const STOP_OWNERS = {
  DARKCHILD: "Darkchild",
  BERLINGTON: "Berlington",
  SITE: "Site / operations",
};
```

### Commercial SaaS Architecture:
Move stop owners into `site_settings` or `organization_settings`:

```javascript
// Dynamic Stop Ownership Model:
export const DEFAULT_STOP_OWNER_TYPES = {
  CONTRACTOR: "Contractor (Mechanical)",  // Deducted from billable hours
  HIRE_FIRM: "Equipment Owner (Wear & Consumables)", // Governed by hire SLA
  CLIENT_SITE: "Client Site (Operational Delays)", // Contractor gets paid full shift
};

// Site settings will store custom display names:
// e.g. contractor_label: "Darkchild Mechanical"
//      owner_label: "Berlington Plant Hire"
//      site_label: "Lafarge Quarry Site"
```

In `src/lib/siteConfig.js`, the admin interface already supports custom stop reasons and inspection items via `AdminSitesPanel.jsx`. Ensuring the downtime attribution formulas in `shiftMetrics.js` reference `siteSettings.contractor_stop_owner` rather than the hardcoded string `"Darkchild"` makes the app 100% turnkey for any fleet.

---

## 3. White-Labeling & Client Branding

High-value enterprise clients ($50k+/yr) often demand their own company logo and colors:

### A. Dynamic Logo Mark
In `src/components/AppShell.jsx`:
- Check `organization.logo_url`. If present, render the client's corporate logo in the navigation header instead of the default OPS badge.
- Fallback to the industrial gold OPS badge for standard tiers.

### B. Custom Subdomains (e.g. `clientname.ops-app.com`)
Using Vercel's Wildcard Domains:
1. Configure `*.ops-app.com` in Vercel.
2. In `src/App.jsx`, detect the subdomain:
```javascript
const subdomain = window.location.hostname.split(".")[0];
// If subdomain is valid, auto-select the organization and theme
```

---

## 4. Automated Subscription Billing Integration

To automate monthly per-machine billing without manual invoice chasing:

### A. Recommended Payment Gateways:
- **For South Africa / Africa:** **PayFast** or **Stripe South Africa** (Supports monthly recurring card debit and instant EFT).
- **For International (US/UK/Australia):** **Stripe Billing** or **Lemon Squeezy**.

### B. Machine Metered Billing:
- Base subscription: Organization subscribes to a tier (e.g. Professional Fleet).
- Usage metering: Count `active = true` machines in the `machines` table on the 1st of each month.
- Automatic bill generation: Charge `active_machines × price_per_machine`.

---

## 5. Offline PWA & Sync Optimization

The app already utilizes **Dexie (IndexedDB)** and background sync engine (`src/lib/sync/engine.js`). To ensure seamless multi-tenant offline security:

- Add `organization_id` to local Dexie stores.
- Clear IndexedDB when a user signs out to prevent data leakage between different users sharing a rugged tablet.
- Maintain client-side image compression (`html2canvas` / media upload) before queueing offline photos so remote uploads don't stall when cellular signal is weak.

---

## 6. Commercial SaaS Packaging Summary

| Feature | Single Pilot (Current) | Multi-Tenant SaaS (Next Step) |
| :--- | :--- | :--- |
| **Database** | Shared tables, single tenant | Supabase RLS with `organization_id` |
| **Stop Reason Owners** | "Darkchild" / "Berlington" / "Site" | Dynamic labels configured in Admin Site Settings |
| **Branding** | OPS / Warrior 2100 | Dynamic client logo + custom color accents |
| **Billing** | Manual invoicing | Automated recurring billing (Stripe / PayFast) |
| **Onboarding** | Manual database insertion | Self-service company signup + 48h guided setup |
