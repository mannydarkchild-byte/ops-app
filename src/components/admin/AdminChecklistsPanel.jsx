import { useEffect, useMemo, useState } from "react";
import { updateSiteSettings } from "../../services/admin.js";
import { resolveSiteSettings } from "../../lib/siteConfig.js";
import { StopReasonsEditor } from "../StopReasonsEditor.jsx";

export function AdminChecklistsPanel({ sites, siteSettings, onSaved, showAlert }) {
  const [siteId, setSiteId] = useState(sites[0]?.id || "");
  const [tab, setTab] = useState("prestart");
  const [busy, setBusy] = useState(false);

  const settings = useMemo(
    () => resolveSiteSettings(siteSettings.find((s) => s.site_id === siteId)),
    [siteSettings, siteId]
  );

  const settingsRow = useMemo(
    () => siteSettings.find((s) => s.site_id === siteId),
    [siteSettings, siteId]
  );

  const [prestartText, setPrestartText] = useState("");
  const [earthmovingText, setEarthmovingText] = useState("");
  const [statusText, setStatusText] = useState("");
  const [groupsText, setGroupsText] = useState("");
  const [earthmovingGroupsText, setEarthmovingGroupsText] = useState("");

  const loadEditor = () => {
    setPrestartText((settings.prestart_items || []).join("\n"));
    setEarthmovingText((settings.earthmoving_prestart_items || []).join("\n"));
    setStatusText((settings.prestart_status_options || []).join(", "));
    setGroupsText(serializeGroups(settings.inspection_groups || []));
    setEarthmovingGroupsText(serializeGroups(settings.earthmoving_inspection_groups || []));
  };

  useEffect(() => {
    if (siteId) loadEditor();
  }, [siteId, settings]);

  const save = async () => {
    setBusy(true);
    try {
      const prestart_items = prestartText.split("\n").map((l) => l.trim()).filter(Boolean);
      const earthmoving_prestart_items = earthmovingText.split("\n").map((l) => l.trim()).filter(Boolean);
      const prestart_status_options = statusText.split(",").map((l) => l.trim()).filter(Boolean);
      const inspection_groups = parseGroups(groupsText);
      const earthmoving_inspection_groups = parseGroups(earthmovingGroupsText);
      if (!prestart_items.length) throw new Error("Screen pre-start needs at least one item");
      if (!earthmoving_prestart_items.length) throw new Error("Excavator and loader pre-start needs at least one item");
      if (!prestart_status_options.length) throw new Error("Status options cannot be empty");
      if (!inspection_groups.length) throw new Error("Screen mechanic inspection needs at least one group");
      if (!earthmoving_inspection_groups.length) throw new Error("Excavator and loader inspection needs at least one group");

      await updateSiteSettings(siteId, {
        prestart_items,
        earthmoving_prestart_items,
        prestart_status_options,
        inspection_groups,
        earthmoving_inspection_groups,
      });
      await onSaved?.();
      showAlert?.("Saved", "Checklists updated for this site.");
    } catch (e) {
      showAlert?.("Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <select
        value={siteId}
        onChange={(e) => setSiteId(e.target.value)}
        className="ops-select"
      >
        {sites.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      <div className="flex gap-1 flex-wrap">
        {[
          { id: "prestart", label: "Pre-start" },
          { id: "mechanic", label: "Mechanic inspection" },
          { id: "stops", label: "Stop owners" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-lg font-logo text-[10px] ${tab === t.id ? "bg-[#F5C518] text-black" : "bg-[#141414] border border-[#2A2A2A] text-[#F2F0EA]/70"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "prestart" && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
          <p className="text-[10px] text-[#F2F0EA]/50">Screen pre-start. One item per line. Used on the screen.</p>
          <textarea
            value={prestartText}
            onChange={(e) => setPrestartText(e.target.value)}
            rows={10}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm font-body"
          />
          <p className="text-[10px] text-[#F2F0EA]/50">Excavator and front end loader. One shared list. One item per line. A machine uses this list when its name or code says excavator, FEL, or loader.</p>
          <textarea
            value={earthmovingText}
            onChange={(e) => setEarthmovingText(e.target.value)}
            rows={10}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm font-body"
          />
          <label className="block text-[10px] text-[#F2F0EA]/50">Status buttons (comma-separated)</label>
          <input
            value={statusText}
            onChange={(e) => setStatusText(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm"
          />
        </div>
      )}

      {tab === "mechanic" && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
          <p className="text-[10px] text-[#F2F0EA]/50">
            Screen inspection. Group lines start with ## Category. Item lines: Item name | Option1, Option2
          </p>
          <textarea
            value={groupsText}
            onChange={(e) => setGroupsText(e.target.value)}
            rows={12}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm font-mono text-xs"
          />
          <p className="text-[10px] text-[#F2F0EA]/50">
            Excavator and front end loader. One shared list. Same format. A machine uses this when its name or code says excavator, FEL, or loader.
          </p>
          <textarea
            value={earthmovingGroupsText}
            onChange={(e) => setEarthmovingGroupsText(e.target.value)}
            rows={12}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm font-mono text-xs"
          />
        </div>
      )}

      {tab === "stops" && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">
          <StopReasonsEditor
            siteId={siteId}
            siteSettingsRow={settingsRow}
            onSaved={onSaved}
            showAlert={showAlert}
          />
        </div>
      )}

      {tab !== "stops" && (
        <button
          type="button"
          onClick={save}
          disabled={busy || !siteId}
          className="w-full bg-[#00A4A6] text-white py-4 rounded-xl font-logo font-bold text-xs disabled:opacity-40"
        >
          SAVE CHECKLISTS
        </button>
      )}
    </div>
  );
}

function serializeGroups(groups) {
  return groups.map((g) => {
    const lines = [`## ${g.category}`];
    for (const [name, opts] of g.items || []) {
      lines.push(`${name} | ${(opts || []).join(", ")}`);
    }
    return lines.join("\n");
  }).join("\n\n");
}

function parseGroups(text) {
  const groups = [];
  let current = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("##")) {
      current = { category: line.replace(/^##\s*/, "").trim(), icon: "🔧", items: [] };
      groups.push(current);
      continue;
    }
    const [namePart, optsPart] = line.split("|").map((s) => s.trim());
    if (!current || !namePart) continue;
    const options = (optsPart || "Good, Attention, Fault").split(",").map((s) => s.trim()).filter(Boolean);
    current.items.push([namePart, options]);
  }
  return groups;
}
