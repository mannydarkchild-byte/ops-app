import { saveLocal, readTable } from "./db.js";
import { WARRIOR_PARTS_CATALOG } from "./constants.js";
import { defaultSiteSettings } from "./siteConfig.js";

const DEFAULT_SITE = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Malekaskraal",
  code: "MLK",
  timezone: "Africa/Johannesburg",
  active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEFAULT_MACHINE = {
  id: "W2100-001",
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

/** Ensure default site/machine exist locally for offline-first boot */
export async function seedLocalDefaults() {
  const sites = await readTable("sites");
  if (!sites.length) {
    await saveLocal("sites", { ...DEFAULT_SITE, _sync_status: "pending" });
  }

  const machines = await readTable("machines");
  if (!machines.length) {
    await saveLocal("machines", { ...DEFAULT_MACHINE, _sync_status: "pending" });
  }

  const siteId = sites[0]?.id || DEFAULT_SITE.id;
  const machineId = machines[0]?.id || DEFAULT_MACHINE.id;

  const siteSettings = await readTable("site_settings");
  if (!siteSettings.some((s) => s.site_id === siteId)) {
    const settings = defaultSiteSettings(siteId);
    settings.primary_machine_id = machineId;
    await saveLocal("site_settings", { ...settings, _sync_status: "pending" });
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
        _sync_status: "pending",
      });
    }
  }
}
