import { useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { VoiceInput } from "./ui/VoiceInput.jsx";

export function RequestPartsModal({ onClose, inventoryItems = [], onSubmit, busy = false }) {
  const [selected, setSelected] = useState({});
  const [customLines, setCustomLines] = useState("");

  const togglePart = (id) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  };

  const setQty = (id, qty) => {
    setSelected((prev) => ({ ...prev, [id]: Math.max(1, Number(qty) || 1) }));
  };

  const submit = async () => {
    const lines = [];
    for (const [id, qty] of Object.entries(selected)) {
      const part = inventoryItems.find((p) => p.id === id);
      if (part) lines.push(`${qty}x ${part.name}`);
    }
    if (customLines.trim()) lines.push(customLines.trim());
    const text = lines.join("\n");
    if (!text) return;
    await onSubmit(text);
  };

  const hasSelection = Object.keys(selected).length > 0 || customLines.trim();

  return (
    <Modal title="REQUEST PARTS" color="blue" onClose={onClose}>
      <p className="text-sm text-[#F2F0EA]/70 mb-3">
        Pick parts from the site list or type what you need. The manager will order them.
      </p>
      <div className="max-h-[30vh] overflow-y-auto space-y-2 mb-3">
        {inventoryItems.length === 0 ? (
          <p className="text-xs text-[#F2F0EA]/40">No parts list on device — type below.</p>
        ) : inventoryItems.map((p) => (
          <div key={p.id} className={`flex items-center gap-2 p-2 rounded-lg border ${selected[p.id] ? "border-[#F5C518] bg-[#F5C518]/10" : "border-[#2A2A2A]"}`}>
            <input type="checkbox" checked={!!selected[p.id]} onChange={() => togglePart(p.id)} />
            <div className="flex-1 min-w-0">
              <p className="font-logo text-xs truncate">{p.name}</p>
              <p className="text-[9px] text-[#F2F0EA]/40">{p.category}</p>
            </div>
            {selected[p.id] && (
              <input
                type="number"
                min={1}
                value={selected[p.id]}
                onChange={(e) => setQty(p.id, e.target.value)}
                className="w-14 bg-[#0A0A0A] border border-[#2A2A2A] rounded p-1 text-center text-sm"
              />
            )}
          </div>
        ))}
      </div>
      <VoiceInput
        value={customLines}
        onChange={setCustomLines}
        placeholder="Other parts (one per line)…"
        rows={3}
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy || !hasSelection}
        className="w-full mt-4 bg-[#F97316] text-white py-4 rounded-xl font-logo font-bold disabled:opacity-40"
      >
        {busy ? "SENDING…" : "SEND PARTS REQUEST TO MANAGER"}
      </button>
    </Modal>
  );
}
