import { readTable, saveLocal } from "../lib/db.js";
import { makeId } from "../lib/utils.js";
import {
  defaultSiteSettings,
  ensureSiteSettings,
  resolveSiteSettings,
  clampCycleDay,
} from "../lib/siteConfig.js";
import { scheduleSync } from "../lib/sync/engine.js";

export async function createSite({ name, code, timezone }) {
  const trimmedName = name?.trim();
  const trimmedCode = code?.trim().toUpperCase();
  if (!trimmedName || !trimmedCode) throw new Error("Site name and code are required");

  const existing = (await readTable("sites")).find((s) => s.code === trimmedCode);
  if (existing) throw new Error(`Site code ${trimmedCode} already exists`);

  const now = new Date().toISOString();
  const site = {
    id: crypto.randomUUID?.() || makeId("site"),
    name: trimmedName,
    code: trimmedCode,
    timezone: timezone || "Africa/Johannesburg",
    active: true,
    created_at: now,
    updated_at: now,
  };
  await saveLocal("sites", site);
  await saveLocal("site_settings", defaultSiteSettings(site.id));
  scheduleSync();
  return site;
}

export async function updateSite(siteId, fields) {
  const sites = await readTable("sites");
  const site = sites.find((s) => s.id === siteId);
  if (!site) throw new Error("Site not found");

  const now = new Date().toISOString();
  const updated = {
    ...site,
    ...fields,
    code: fields.code != null ? String(fields.code).trim().toUpperCase() : site.code,
    name: fields.name != null ? String(fields.name).trim() : site.name,
    updated_at: now,
  };
  await saveLocal("sites", updated);
  scheduleSync();
  return updated;
}

export async function createMachine({
  siteId, name, code, type, startHourMeter, billableRate,
}) {
  if (!siteId) throw new Error("Site is required");
  const trimmedName = name?.trim();
  const trimmedCode = code?.trim().toUpperCase();
  if (!trimmedName || !trimmedCode) throw new Error("Machine name and code are required");

  const now = new Date().toISOString();
  const suffix = (crypto.randomUUID?.() || makeId("")).slice(0, 4).toUpperCase();
  const machine = {
    id: `${trimmedCode}-${suffix}`,
    site_id: siteId,
    name: trimmedName,
    code: trimmedCode,
    type: type?.trim() || "Screen",
    start_hour_meter: Number(startHourMeter) || 0,
    billable_rate: Number(billableRate) || 0,
    active: true,
    created_at: now,
    updated_at: now,
  };
  await saveLocal("machines", machine);
  scheduleSync();
  return machine;
}

export async function updateMachine(machineId, fields) {
  const machines = await readTable("machines");
  const machine = machines.find((m) => m.id === machineId);
  if (!machine) throw new Error("Machine not found");

  const now = new Date().toISOString();
  const updated = {
    ...machine,
    ...fields,
    name: fields.name != null ? String(fields.name).trim() : machine.name,
    code: fields.code != null ? String(fields.code).trim().toUpperCase() : machine.code,
    start_hour_meter: fields.start_hour_meter != null ? Number(fields.start_hour_meter) : machine.start_hour_meter,
    billable_rate: fields.billable_rate != null ? Number(fields.billable_rate) : machine.billable_rate,
    updated_at: now,
  };
  await saveLocal("machines", updated);
  scheduleSync();
  return updated;
}

export async function updateSiteSettings(siteId, fields) {
  const current = resolveSiteSettings(await ensureSiteSettings(siteId));
  const now = new Date().toISOString();
  const updated = {
    ...current,
    ...fields,
    billing_cycle_start_day: fields.billing_cycle_start_day != null
      ? clampCycleDay(fields.billing_cycle_start_day)
      : current.billing_cycle_start_day,
    updated_at: now,
  };
  await saveLocal("site_settings", updated);
  scheduleSync();
  return updated;
}
