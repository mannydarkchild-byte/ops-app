import { readTable, saveLocal } from "../lib/db.js";
import { makeId } from "../lib/utils.js";
import { scheduleSync } from "../lib/sync/engine.js";

export async function createInventoryItem({ siteId, sku, name, category, unit, reorderLevel }) {
  const trimmedSku = sku?.trim().toUpperCase();
  const trimmedName = name?.trim();
  if (!siteId || !trimmedSku || !trimmedName) throw new Error("Site, SKU, and name are required");

  const existing = (await readTable("inventory_items")).find(
    (i) => i.site_id === siteId && i.sku === trimmedSku
  );
  if (existing) throw new Error(`SKU ${trimmedSku} already exists on this site`);

  const now = new Date().toISOString();
  const item = {
    id: `INV-${trimmedSku}`,
    site_id: siteId,
    sku: trimmedSku,
    name: trimmedName,
    category: category?.trim() || "General",
    quantity_on_hand: 0,
    unit: unit?.trim() || "each",
    reorder_level: Number(reorderLevel) || 1,
    created_at: now,
    updated_at: now,
  };
  await saveLocal("inventory_items", item);
  scheduleSync();
  return item;
}

export async function updateInventoryItem(itemId, fields) {
  const items = await readTable("inventory_items");
  const item = items.find((i) => i.id === itemId);
  if (!item) throw new Error("Part not found");

  const now = new Date().toISOString();
  const updated = {
    ...item,
    ...fields,
    name: fields.name != null ? String(fields.name).trim() : item.name,
    category: fields.category != null ? String(fields.category).trim() : item.category,
    quantity_on_hand: fields.quantity_on_hand != null ? Number(fields.quantity_on_hand) : item.quantity_on_hand,
    reorder_level: fields.reorder_level != null ? Number(fields.reorder_level) : item.reorder_level,
    updated_at: now,
  };
  await saveLocal("inventory_items", updated);
  scheduleSync();
  return updated;
}
