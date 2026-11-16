import { useEffect, useMemo, useState } from "react";
import { updateSiteSettings } from "../services/admin.js";
import { resolveSiteSettings } from "../lib/siteConfig.js";
import {
  DEFAULT_STOP_REASONS,
  STOP_CATEGORY_META,
} from "../lib/stopReasons.js";

/** Admin + Manager: lock the six stop categories and name the owners. */
export function StopReasonsEditor({ siteId, siteSettingsRow, onSaved, showAlert }) {
  const settings = useMemo(
    () => resolveSiteSettings(siteSettingsRow || { site_id: siteId }),
    [siteSettingsRow, siteId]
  );
  const [contractorName, setContractorName] = useState(settings.contractor_name || "Darkchild");
  const [equipmentOwnerName, setEquipmentOwnerName] = useState(settings.equipment_owner_name || "Berlington");
  const [clientSiteName, setClientSiteName] = useState(settings.client_site_name || "Site / operations");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setContractorName(settings.contractor_name || "Darkchild");
    setEquipmentOwnerName(settings.equipment_owner_name || "Berlington");
    setClientSiteName(settings.client_site_name || "Site / operations");
  }, [
    settings.contractor_name,
    settings.equipment_owner_name,
    settings.client_site_name,
    siteId,
  ]);

  const save = async () => {
    if (!siteId) return;
    setBusy(true);
    try {
      await updateSiteSettings(siteId, {
        stop_reasons: DEFAULT_STOP_REASONS.map((r) => ({ ...r })),
        contractor_name: contractorName.trim() || "Darkchild",
        equipment_owner_name: equipmentOwnerName.trim() || "Berlington",
        client_site_name: clientSiteName.trim() || "Site / operations",
      });
      await onSaved?.();
      showAlert?.("Saved", "Stop categories and owners updated for this site.");
    } catch (e) {
      showAlert?.("Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const resetDefaults = () => {
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
        Every stop falls into one of six categories. {contractorName} owns mechanical, hydraulic, engine, and electrical
        (deducted). {equipmentOwnerName} owns consumables — wear, diesel, oil, grease, meshes (no deduction).
        {" "}{clientSiteName} owns weather, strike, no material, and blockages (standing time).
        Operators still add a note after they pick the category.
      </p>

      <div className="space-y-2">
        {STOP_CATEGORY_META.map((row) => {
          const owner = row.role === "contractor"
            ? contractorName
            : row.role === "wear"
              ? equipmentOwnerName
              : clientSiteName;
          return (
            <div key={row.reason} className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-ui text-sm text-[#F2F0EA]">{row.reason}</p>
                <p className="font-body text-[11px] text-[#F5C518] shrink-0">{owner}</p>
              </div>
              <p className="font-body text-[12px] text-[#F2F0EA]/55 mt-0.5">{row.hint}. {row.examples}.</p>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={resetDefaults}
          className="flex-1 border border-[#2A2A2A] text-[#F2F0EA]/70 py-3 rounded-xl font-logo text-xs"
        >
          Reset names
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
