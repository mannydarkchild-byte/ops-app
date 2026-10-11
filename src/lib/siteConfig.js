import { readTable, saveLocal } from "./db.js";
import {
  PRESTART_INSPECTION_ITEMS,
  EARTHMOVING_PRESTART_ITEMS,
  PRESTART_STATUS_OPTIONS,
  INSPECTION_GROUPS,
  EARTHMOVING_INSPECTION_GROUPS,
  PRIMARY_MACHINE_CODE,
} from "./constants.js";
import { DEFAULT_STOP_REASONS, normalizeStopReasons } from "./stopReasons.js";

export const DEFAULT_BILLING_CYCLE_START_DAY = 26;

export function settingsIdForSite(siteId) {
  return `settings-${siteId}`;
}

export function defaultSiteSettings(siteId) {
  const now = new Date().toISOString();
  return {
    id: settingsIdForSite(siteId),
    site_id: siteId,
    billing_cycle_start_day: DEFAULT_BILLING_CYCLE_START_DAY,
    primary_machine_id: null,
    contractor_name: "Darkchild",
    equipment_owner_name: "Berlington",
    client_site_name: "Site / operations",
    excavator_bucket_tonnes: null,
    fel_bucket_tonnes: null,
    prestart_items: [...PRESTART_INSPECTION_ITEMS],
    earthmoving_prestart_items: [...EARTHMOVING_PRESTART_ITEMS],
    prestart_status_options: [...PRESTART_STATUS_OPTIONS],
    inspection_groups: JSON.parse(JSON.stringify(INSPECTION_GROUPS)),
    earthmoving_inspection_groups: JSON.parse(JSON.stringify(EARTHMOVING_INSPECTION_GROUPS)),
    stop_reasons: DEFAULT_STOP_REASONS.map((r) => ({ ...r })),
    created_at: now,
    updated_at: now,
  };
}

export function resolveSiteSettings(row) {
  const defaults = defaultSiteSettings(row?.site_id || "unknown");
  return {
    ...defaults,
    ...row,
    contractor_name: row?.contractor_name || defaults.contractor_name,
    equipment_owner_name: row?.equipment_owner_name || defaults.equipment_owner_name,
    client_site_name: row?.client_site_name || defaults.client_site_name,
    prestart_items: row?.prestart_items?.length ? row.prestart_items : defaults.prestart_items,
    earthmoving_prestart_items: row?.earthmoving_prestart_items?.length ? row.earthmoving_prestart_items : defaults.earthmoving_prestart_items,
    prestart_status_options: row?.prestart_status_options?.length ? row.prestart_status_options : defaults.prestart_status_options,
    inspection_groups: row?.inspection_groups?.length ? row.inspection_groups : defaults.inspection_groups,
    earthmoving_inspection_groups: row?.earthmoving_inspection_groups?.length
      ? row.earthmoving_inspection_groups
      : defaults.earthmoving_inspection_groups,
    stop_reasons: normalizeStopReasons(row?.stop_reasons),
    billing_cycle_start_day: clampCycleDay(row?.billing_cycle_start_day),
  };
}

/** Excavator and front end loader share one list. The screen keeps the site pre-start. */
export function machineUsesEarthmovingPrestart(machine) {
  const text = `${machine?.name || ""} ${machine?.code || ""} ${machine?.type || ""}`.toLowerCase();
  return /\bexcavator\b/.test(text)
    || /\bfel\b/.test(text)
    || /front[\s-]*end/.test(text)
    || /\bloader\b/.test(text);
}

/** Screen keeps the screen inspection. Excavator and loader share one list. */
export function inspectionGroupsForMachine(settings, machine) {
  if (machineUsesEarthmovingPrestart(machine)) {
    return settings?.earthmoving_inspection_groups?.length
      ? settings.earthmoving_inspection_groups
      : JSON.parse(JSON.stringify(EARTHMOVING_INSPECTION_GROUPS));
  }
  return settings?.inspection_groups?.length
    ? settings.inspection_groups
    : JSON.parse(JSON.stringify(INSPECTION_GROUPS));
}

export function prestartItemsForMachine(settings, machine) {
  if (machineUsesEarthmovingPrestart(machine)) {
    return settings?.earthmoving_prestart_items?.length
      ? settings.earthmoving_prestart_items
      : [...EARTHMOVING_PRESTART_ITEMS];
  }
  return settings?.prestart_items?.length ? settings.prestart_items : [...PRESTART_INSPECTION_ITEMS];
}

export function clampCycleDay(day) {
  const n = Number(day);
  if (!Number.isFinite(n)) return DEFAULT_BILLING_CYCLE_START_DAY;
  return Math.min(28, Math.max(1, Math.round(n)));
}

/** One settings object per site. If sync left two rows, keep the filled-in values. */
export function pickSiteSettings(rows, siteId) {
  const matches = (rows || []).filter((row) => row?.site_id === siteId);
  if (!matches.length) return resolveSiteSettings(defaultSiteSettings(siteId || "unknown"));
  const sorted = [...matches].sort((a, b) => String(a.updated_at || "").localeCompare(String(b.updated_at || "")));
  const merged = { site_id: siteId };
  for (const row of sorted) {
    for (const [key, value] of Object.entries(row)) {
      if (value != null && value !== "") merged[key] = value;
    }
  }
  return resolveSiteSettings(merged);
}

export function tonnesPerBucket(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function ensureSiteSettings(siteId) {
  if (!siteId) return resolveSiteSettings(defaultSiteSettings("unknown"));
  const all = await readTable("site_settings");
  const matches = all.filter((s) => s.site_id === siteId);
  if (!matches.length) {
    const row = defaultSiteSettings(siteId);
    await saveLocal("site_settings", { ...row, _sync_status: "synced" }, { enqueue: false });
    return resolveSiteSettings(row);
  }
  return pickSiteSettings(all, siteId);
}

export async function getPrestartConfigForSite(siteId) {
  const row = await ensureSiteSettings(siteId);
  return {
    items: row.prestart_items,
    statusOptions: row.prestart_status_options,
  };
}

export function getMechanicItemsFromGroups(groups) {
  return (groups || INSPECTION_GROUPS).flatMap((group) =>
    group.items.map(([item_name, options]) => ({
      item_name,
      category: group.category,
      options,
    }))
  );
}

export async function getInspectionConfigForSite(siteId) {
  const row = await ensureSiteSettings(siteId);
  return {
    groups: row.inspection_groups,
    items: getMechanicItemsFromGroups(row.inspection_groups),
  };
}

export function getPrimaryMachineFromSettings(machines, siteId, settings) {
  if (!machines?.length) return null;
  const onSite = machines.filter((m) => m.site_id === siteId && m.active !== false);
  if (settings?.primary_machine_id) {
    const picked = onSite.find((m) => m.id === settings.primary_machine_id);
    if (picked) return picked;
  }
  return (
    onSite.find((m) => m.code === PRIMARY_MACHINE_CODE) ||
    onSite[0] ||
    machines.find((m) => m.code === PRIMARY_MACHINE_CODE) ||
    machines[0]
  );
}
