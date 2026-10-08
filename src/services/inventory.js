import { readTable, saveLocal } from "../lib/db.js";
import { makeId } from "../lib/utils.js";
import { scheduleSync } from "../lib/sync/engine.js";

async function recordMovement(user, item, delta, reason) {
  const now = new Date().toISOString();
  const next = Math.round((Number(item.quantity_on_hand || 0) + delta) * 100) / 100;
  if (next < 0) throw new Error("Not enough on hand");
  const updated = { ...item, quantity_on_hand: next, updated_at: now, _sync_status: "pending" };
  await saveLocal("inventory_items", updated);
  await saveLocal("inventory_movements", {
    id: makeId("MOV"),
    site_id: item.site_id,
    inventory_item_id: item.id,
    quantity_change: delta,
    reason: reason?.trim() || (delta > 0 ? "Received" : "Issued"),
    performed_by: user?.id || null,
    performed_by_name: user?.name || null,
    created_at: now,
    _sync_status: "pending",
  });
  scheduleSync();
  return updated;
}

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

/** Goods into the storeroom. */
export async function receiveInventory(user, item, quantity, reason) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("Enter how many arrived");
  return recordMovement(user, item, qty, reason || "Received");
}

/** Tools or parts leaving the storeroom. */
export async function issueInventory(user, item, quantity, reason) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("Enter how many to issue");
  return recordMovement(user, item, -qty, reason || "Issued");
}
