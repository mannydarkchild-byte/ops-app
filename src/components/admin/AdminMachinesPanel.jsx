import { useState } from "react";
import { createMachine, updateMachine } from "../../services/admin.js";

export function AdminMachinesPanel({ sites, machines, onSaved, showAlert }) {
  const [siteFilter, setSiteFilter] = useState(sites[0]?.id || "all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    siteId: sites[0]?.id || "",
    name: "",
    code: "",
    type: "Screen",
    startHourMeter: 0,
    billableRate: 1800,
  });
  const [busy, setBusy] = useState(false);

  const visible = machines.filter((m) => siteFilter === "all" || m.site_id === siteFilter);

  const saveMachine = async (machineId, fields) => {
    setBusy(true);
    try {
      await updateMachine(machineId, fields);
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
      await createMachine(form);
      setShowAdd(false);
      setForm((f) => ({ ...f, name: "", code: "" }));
      await onSaved?.();
      showAlert?.("Machine added", "New machine saved.");
    } catch (e) {
      showAlert?.("Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="flex-1 min-w-[140px] bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl font-logo text-xs text-[#F2F0EA]"
        >
          <option value="all">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-3 rounded-xl font-logo text-xs bg-[#22C55E] text-black font-bold"
        >
          + ADD MACHINE
        </button>
      </div>

      {showAdd && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 space-y-2">
          <select
            value={form.siteId}
            onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Machine name"
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm"
          />
          <input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="Code (e.g. W2100)"
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={form.startHourMeter}
              onChange={(e) => setForm((f) => ({ ...f, startHourMeter: e.target.value }))}
              placeholder="Start meter"
              className="bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm"
            />
            <input
              type="number"
              value={form.billableRate}
              onChange={(e) => setForm((f) => ({ ...f, billableRate: e.target.value }))}
              placeholder="Rate R/h"
              className="bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy || !form.name || !form.code || !form.siteId}
            className="w-full bg-[#F5C518] text-black py-3 rounded-xl font-logo font-bold text-xs disabled:opacity-40"
          >
            CREATE MACHINE
          </button>
        </div>
      )}

      <div className="space-y-3">
        {visible.length === 0 ? (
          <p className="text-sm text-[#F2F0EA]/40">No machines for this filter.</p>
        ) : visible.map((m) => (
          <div key={m.id} className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="font-logo text-sm">{m.name}</p>
                <p className="text-[10px] text-[#F2F0EA]/40">
                  {m.code} · {sites.find((s) => s.id === m.site_id)?.name || "—"}
                </p>
              </div>
              <label className="flex items-center gap-1 text-[10px] font-logo">
                <input
                  type="checkbox"
                  checked={m.active !== false}
                  onChange={(e) => saveMachine(m.id, { active: e.target.checked })}
                  disabled={busy}
                />
                Active
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[#F2F0EA]/50">Billable rate R/h</label>
                <input
                  type="number"
                  defaultValue={m.billable_rate}
                  onBlur={(e) => saveMachine(m.id, { billable_rate: Number(e.target.value) })}
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-2 rounded text-[#F2F0EA] text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#F2F0EA]/50">Start hour meter</label>
                <input
                  type="number"
                  defaultValue={m.start_hour_meter}
                  onBlur={(e) => saveMachine(m.id, { start_hour_meter: Number(e.target.value) })}
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-2 rounded text-[#F2F0EA] text-sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
