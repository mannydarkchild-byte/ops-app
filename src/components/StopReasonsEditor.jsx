import { useEffect, useMemo, useState } from "react";
import { updateSiteSettings } from "../services/admin.js";
import { resolveSiteSettings } from "../lib/siteConfig.js";
import {
  parseStopReasonsText,
  serializeStopReasons,
} from "../lib/stopReasons.js";

/** Admin + Manager: edit stop reasons and who owns the downtime. */
export function StopReasonsEditor({ siteId, siteSettingsRow, onSaved, showAlert }) {
  const settings = useMemo(
    () => resolveSiteSettings(siteSettingsRow || { site_id: siteId }),
    [siteSettingsRow, siteId]
  );
  const [text, setText] = useState("");
  const [contractorName, setContractorName] = useState(settings.contractor_name || "Darkchild");
  const [equipmentOwnerName, setEquipmentOwnerName] = useState(settings.equipment_owner_name || "Berlington");
  const [clientSiteName, setClientSiteName] = useState(settings.client_site_name || "Site / operations");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setText(serializeStopReasons(settings.stop_reasons));
    setContractorName(settings.contractor_name || "Darkchild");
    setEquipmentOwnerName(settings.equipment_owner_name || "Berlington");
    setClientSiteName(settings.client_site_name || "Site / operations");
  }, [
    settings.stop_reasons,
    settings.contractor_name,
    settings.equipment_owner_name,
    settings.client_site_name,
    siteId,
  ]);

  const save = async () => {
    if (!siteId) return;
    setBusy(true);
    try {
      const stop_reasons = parseStopReasonsText(text);
      if (!stop_reasons.length) throw new Error("Add at least one stop reason");
      await updateSiteSettings(siteId, {
        stop_reasons,
        contractor_name: contractorName.trim() || "Darkchild",
        equipment_owner_name: equipmentOwnerName.trim() || "Berlington",
        client_site_name: clientSiteName.trim() || "Site / operations",
      });
      await onSaved?.();
      showAlert?.("Saved", "Stop reasons and entity owners updated for this site.");
    } catch (e) {
      showAlert?.("Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const resetDefaults = () => {
    setText(serializeStopReasons(null));
    setContractorName("Darkchild");
    setEquipmentOwnerName("Berlington");
    setClientSiteName("Site / operations");
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#141414] p-3 rounded-xl border border-[#2A2A2A] space-y-3">
        <p className="font-logo text-xs text-[#F5C518] tracking-wider uppercase">Downtime Ownership Entities</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <label className="text-xs text-[#F2F0EA]/70 space-y-1 block">
            <span className="font-semibold text-[#F2F0EA]">Contractor (Breakdowns · Deducted)</span>
            <input
              type="text"
              value={contractorName}
              onChange={(e) => setContractorName(e.target.value)}
              placeholder="e.g. Darkchild"
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-2 rounded-lg text-sm text-[#F2F0EA]"
            />
          </label>
          <label className="text-xs text-[#F2F0EA]/70 space-y-1 block">
            <span className="font-semibold text-[#F2F0EA]">Equipment / Wear Owner (No Deduction)</span>
            <input
              type="text"
              value={equipmentOwnerName}
              onChange={(e) => setEquipmentOwnerName(e.target.value)}
              placeholder="e.g. Berlington"
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-2 rounded-lg text-sm text-[#F2F0EA]"
            />
          </label>
          <label className="text-xs text-[#F2F0EA]/70 space-y-1 block">
            <span className="font-semibold text-[#F2F0EA]">Client / Site Standing Time (No Deduction)</span>
            <input
              type="text"
              value={clientSiteName}
              onChange={(e) => setClientSiteName(e.target.value)}
              placeholder="e.g. Site / operations"
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-2 rounded-lg text-sm text-[#F2F0EA]"
            />
          </label>
        </div>
      </div>

      <p className="font-body text-xs text-[#F2F0EA]/70 bg-[#16140F] p-3 rounded-xl border border-[#2A2A2A]">
        One line per reason: <span className="text-[#F5C518] font-mono">Reason | Owner</span>.<br />
        • <strong className="text-[#F2F0EA]">{contractorName}</strong> downtime (mechanical breakdowns) is <strong>deducted</strong> from shift hours.<br />
        • <strong className="text-[#F2F0EA]">{clientSiteName}</strong> (waiting for material, haul trucks, weather) and <strong className="text-[#F2F0EA]">{equipmentOwnerName}</strong> (wear parts) are <strong>standing time</strong> — shift hours are <strong>not deducted</strong>.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA] text-sm font-mono"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={resetDefaults}
          className="flex-1 border border-[#2A2A2A] text-[#F2F0EA]/70 py-3 rounded-xl font-logo text-xs"
        >
          Reset defaults
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || !siteId}
          className="flex-[2] bg-[#F5C518] text-black py-3 rounded-xl font-logo text-xs font-bold disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save stop owners"}
        </button>
      </div>
    </div>
  );
}
