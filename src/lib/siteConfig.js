import { readTable, saveLocal } from "./db.js";
import {
  PRESTART_INSPECTION_ITEMS,
  PRESTART_STATUS_OPTIONS,
  INSPECTION_GROUPS,
  PRIMARY_MACHINE_CODE,
} from "./constants.js";

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
    prestart_items: [...PRESTART_INSPECTION_ITEMS],
    prestart_status_options: [...PRESTART_STATUS_OPTIONS],
    inspection_groups: JSON.parse(JSON.stringify(INSPECTION_GROUPS)),
    created_at: now,
    updated_at: now,
  };
}

export function resolveSiteSettings(row) {
  const defaults = defaultSiteSettings(row?.site_id || "unknown");
  return {
    ...defaults,
    ...row,
    prestart_items: row?.prestart_items?.length ? row.prestart_items : defaults.prestart_items,
    prestart_status_options: row?.prestart_status_options?.length ? row.prestart_status_options : defaults.prestart_status_options,
    inspection_groups: row?.inspection_groups?.length ? row.inspection_groups : defaults.inspection_groups,
    billing_cycle_start_day: clampCycleDay(row?.billing_cycle_start_day),
  };
}

export function clampCycleDay(day) {
  const n = Number(day);
  if (!Number.isFinite(n)) return DEFAULT_BILLING_CYCLE_START_DAY;
  return Math.min(28, Math.max(1, Math.round(n)));
}

export async function ensureSiteSettings(siteId) {
  if (!siteId) return resolveSiteSettings(defaultSiteSettings("unknown"));
  const all = await readTable("site_settings");
  let row = all.find((s) => s.site_id === siteId);
  if (!row) {
    row = defaultSiteSettings(siteId);
    await saveLocal("site_settings", { ...row, _sync_status: "synced" }, { enqueue: false });
  }
  return resolveSiteSettings(row);
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
