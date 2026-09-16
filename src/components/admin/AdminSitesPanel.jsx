import { useMemo, useState } from "react";
import { createSite, updateSite, updateSiteSettings } from "../../services/admin.js";
import { resolveSiteSettings } from "../../lib/siteConfig.js";

export function AdminSitesPanel({ sites, machines, siteSettings, onSaved, showAlert }) {
  const [selectedId, setSelectedId] = useState(sites[0]?.id || "");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = sites.find((s) => s.id === selectedId) || sites[0];
  const settings = useMemo(
    () => resolveSiteSettings(siteSettings.find((s) => s.site_id === selected?.id)),
    [siteSettings, selected?.id]
  );
  const siteMachines = machines.filter((m) => m.site_id === selected?.id && m.active !== false);

  const saveSite = async (fields) => {
    if (!selected) return;
    setBusy(true);
    try {
      await updateSite(selected.id, fields);
      await onSaved?.();
      showAlert?.("Saved", "Site updated.");
    } catch (e) {
      showAlert?.("Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (fields) => {
    if (!selected) return;
    setBusy(true);
    try {
      await updateSiteSettings(selected.id, fields);
      await onSaved?.();
      showAlert?.("Saved", "Site settings updated.");
    } catch (e) {
      showAlert?.("Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAddSite = async () => {
    setBusy(true);
    try {
      const site = await createSite({ name: newName, code: newCode });
      setNewName("");
      setNewCode("");
      setShowAdd(false);
      setSelectedId(site.id);
      await onSaved?.();
      showAlert?.("Site added", `${site.name} created. Add machines next.`);
    } catch (e) {
      showAlert?.("Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={selected?.id || ""}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 min-w-[160px] bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl font-logo text-xs text-[#F2F0EA]"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-3 rounded-xl font-logo text-xs bg-[#22C55E] text-black font-bold"
        >
          + ADD SITE
        </button>
      </div>

      {showAdd && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 space-y-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Site name"
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm"
          />
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="Code (e.g. MLK)"
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm"
          />
          <button
            type="button"
            onClick={handleAddSite}
            disabled={busy || !newName || !newCode}
            className="w-full bg-[#F5C518] text-black py-3 rounded-xl font-logo font-bold text-xs disabled:opacity-40"
          >
            CREATE SITE
          </button>
        </div>
      )}

      {selected && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
          <p className="font-logo text-[10px] text-[#F5C518] tracking-wider">SITE DETAILS</p>
          <label className="block text-[10px] text-[#F2F0EA]/50">Name</label>
          <input
            defaultValue={selected.name}
            onBlur={(e) => e.target.value !== selected.name && saveSite({ name: e.target.value })}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm"
          />
          <label className="block text-[10px] text-[#F2F0EA]/50">Code</label>
          <input
            defaultValue={selected.code}
            onBlur={(e) => e.target.value.toUpperCase() !== selected.code && saveSite({ code: e.target.value })}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm"
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              defaultChecked={selected.active !== false}
              onChange={(e) => saveSite({ active: e.target.checked })}
            />
            Active site
          </label>

          <p className="font-logo text-[10px] text-[#F5C518] tracking-wider pt-2">BILLING & PRIMARY MACHINE</p>
          <label className="block text-[10px] text-[#F2F0EA]/50">Billing cycle start day (1–28)</label>
          <input
            type="number"
            min={1}
            max={28}
            defaultValue={settings.billing_cycle_start_day}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v !== settings.billing_cycle_start_day) saveSettings({ billing_cycle_start_day: v });
            }}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm"
          />
          <label className="block text-[10px] text-[#F2F0EA]/50">Primary machine (manager dashboard)</label>
          <select
            value={settings.primary_machine_id || ""}
            onChange={(e) => saveSettings({ primary_machine_id: e.target.value || null })}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm"
          >
            <option value="">Auto (first / W2100)</option>
            {siteMachines.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
            ))}
          </select>
          <p className="text-[10px] text-[#F2F0EA]/40">{siteMachines.length} active machine(s) on this site</p>
        </div>
      )}
    </div>
  );
}
