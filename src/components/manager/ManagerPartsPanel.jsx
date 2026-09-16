import { useMemo, useState } from "react";
import { createInventoryItem, updateInventoryItem } from "../../services/inventory.js";

export function ManagerPartsPanel({ siteId, inventoryItems, onSaved, showAlert }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ sku: "", name: "", category: "General", reorderLevel: 1 });
  const [busy, setBusy] = useState(false);

  const parts = useMemo(
    () => inventoryItems.filter((i) => i.site_id === siteId).sort((a, b) => a.name.localeCompare(b.name)),
    [inventoryItems, siteId]
  );

  const saveItem = async (itemId, fields) => {
    setBusy(true);
    try {
      await updateInventoryItem(itemId, fields);
      await onSaved?.();
    } catch (e) {
      showAlert?.("Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async () => {
    setBusy(true);
    try {
      await createInventoryItem({ siteId, ...form });
      setForm({ sku: "", name: "", category: "General", reorderLevel: 1 });
      setShowAdd(false);
      await onSaved?.();
      showAlert?.("Part added", "Catalog updated.");
    } catch (e) {
      showAlert?.("Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-[#F2F0EA]/40">
        Site parts catalog — mechanics request from this list. Admin does not manage parts.
      </p>

      <button
        type="button"
        onClick={() => setShowAdd(!showAdd)}
        className="w-full bg-[#22C55E] text-black py-3 rounded-xl font-logo font-bold text-xs"
      >
        + ADD PART
      </button>

      {showAdd && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 space-y-2">
          <input
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            placeholder="SKU"
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm"
          />
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Part name"
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm"
          />
          <input
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="Category"
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy || !form.sku || !form.name}
            className="w-full bg-[#F5C518] text-black py-3 rounded-xl font-logo font-bold text-xs disabled:opacity-40"
          >
            SAVE PART
          </button>
        </div>
      )}

      <div className="space-y-2">
        {parts.length === 0 ? (
          <p className="text-sm text-[#F2F0EA]/40">No parts yet.</p>
        ) : parts.map((p) => (
          <div key={p.id} className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-3">
            <div className="flex justify-between gap-2">
              <div>
                <p className="font-logo text-xs">{p.name}</p>
                <p className="text-[10px] text-[#F2F0EA]/40">{p.sku} · {p.category}</p>
              </div>
              <span className="font-logo text-[10px] text-[#F2F0EA]/50">Qty {p.quantity_on_hand ?? 0}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input
                defaultValue={p.name}
                onBlur={(e) => e.target.value !== p.name && saveItem(p.id, { name: e.target.value })}
                className="bg-[#0A0A0A] border border-[#2A2A2A] p-2 rounded text-[#F2F0EA] text-xs"
              />
              <input
                type="number"
                defaultValue={p.quantity_on_hand ?? 0}
                onBlur={(e) => saveItem(p.id, { quantity_on_hand: Number(e.target.value) })}
                className="bg-[#0A0A0A] border border-[#2A2A2A] p-2 rounded text-[#F2F0EA] text-xs"
                title="Quantity on hand"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
