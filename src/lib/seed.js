import { saveLocal, readTable, ensureDB } from "./db.js";
import { WARRIOR_PARTS_CATALOG } from "./constants.js";
import { defaultSiteSettings } from "./siteConfig.js";

export const BOOTSTRAP_SITE_ID = "00000000-0000-0000-0000-000000000001";
export const BOOTSTRAP_MACHINE_ID = "W2100-001";

const DEFAULT_SITE = {
  id: BOOTSTRAP_SITE_ID,
  name: "Malekaskraal",
  code: "MLK",
  timezone: "Africa/Johannesburg",
  active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEFAULT_MACHINE = {
  id: BOOTSTRAP_MACHINE_ID,
  site_id: DEFAULT_SITE.id,
  name: "Powerscreen Warrior 2100",
  code: "W2100",
  type: "Screen",
  start_hour_meter: 5032,
  billable_rate: 1800,
  active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/** Local-only bootstrap rows — already on server via migration; do not push from operators */
const LOCAL_BOOTSTRAP = {
  sites: [BOOTSTRAP_SITE_ID],
  machines: [BOOTSTRAP_MACHINE_ID],
  inventory_items: WARRIOR_PARTS_CATALOG.map((p) => `INV-${p.sku}`),
};

/** Clear stale sync queue entries for offline bootstrap catalog rows */
export async function reconcileBootstrapSyncQueue() {
  const database = await ensureDB();
  for (const [table, ids] of Object.entries(LOCAL_BOOTSTRAP)) {
    for (const id of ids) {
      const row = await database[table]?.get(id);
      if (!row) continue;
      if (row._sync_status !== "synced") {
        await database[table].update(id, { _sync_status: "synced" });
      }
      await database.sync_queue.where({ table, record_id: id }).delete();
    }
  }
}

/** Ensure default site/machine exist locally for offline-first boot */
export async function seedLocalDefaults() {
  const sites = await readTable("sites");
  if (!sites.length) {
    await saveLocal("sites", { ...DEFAULT_SITE, _sync_status: "synced" }, { enqueue: false });
  }

  const machines = await readTable("machines");
  if (!machines.length) {
    await saveLocal("machines", { ...DEFAULT_MACHINE, _sync_status: "synced" }, { enqueue: false });
  }

  const siteId = sites[0]?.id || DEFAULT_SITE.id;
  const machineId = machines[0]?.id || DEFAULT_MACHINE.id;

  const siteSettings = await readTable("site_settings");
  if (!siteSettings.some((s) => s.site_id === siteId)) {
    const settings = defaultSiteSettings(siteId);
    settings.primary_machine_id = machineId;
    await saveLocal("site_settings", { ...settings, _sync_status: "synced" }, { enqueue: false });
  }
  const inventory = await readTable("inventory_items");
  if (!inventory.length) {
    const now = new Date().toISOString();
    for (const part of WARRIOR_PARTS_CATALOG) {
      await saveLocal("inventory_items", {
        id: `INV-${part.sku}`,
        site_id: siteId,
        sku: part.sku,
        name: part.name,
        category: part.category,
        quantity_on_hand: 0,
        unit: "each",
        reorder_level: 1,
        created_at: now,
        updated_at: now,
        _sync_status: "synced",
      }, { enqueue: false });
    }
  }

  await reconcileBootstrapSyncQueue();
}
