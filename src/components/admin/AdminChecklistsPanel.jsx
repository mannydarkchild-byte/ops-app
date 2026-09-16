import { useEffect, useMemo, useState } from "react";
import { updateSiteSettings } from "../../services/admin.js";
import { resolveSiteSettings } from "../../lib/siteConfig.js";

export function AdminChecklistsPanel({ sites, siteSettings, onSaved, showAlert }) {
  const [siteId, setSiteId] = useState(sites[0]?.id || "");
  const [tab, setTab] = useState("prestart");
  const [busy, setBusy] = useState(false);

  const settings = useMemo(
    () => resolveSiteSettings(siteSettings.find((s) => s.site_id === siteId)),
    [siteSettings, siteId]
  );

  const [prestartText, setPrestartText] = useState("");
  const [statusText, setStatusText] = useState("");
  const [groupsText, setGroupsText] = useState("");

  const loadEditor = () => {
    setPrestartText((settings.prestart_items || []).join("\n"));
    setStatusText((settings.prestart_status_options || []).join(", "));
    setGroupsText(serializeGroups(settings.inspection_groups || []));
  };

  useEffect(() => {
    if (siteId) loadEditor();
  }, [siteId, settings]);

  const save = async () => {
    setBusy(true);
    try {
      const prestart_items = prestartText.split("\n").map((l) => l.trim()).filter(Boolean);
      const prestart_status_options = statusText.split(",").map((l) => l.trim()).filter(Boolean);
      const inspection_groups = parseGroups(groupsText);
      if (!prestart_items.length) throw new Error("Pre-start checklist needs at least one item");
      if (!prestart_status_options.length) throw new Error("Status options cannot be empty");
      if (!inspection_groups.length) throw new Error("Mechanic inspection needs at least one group");

      await updateSiteSettings(siteId, {
        prestart_items,
        prestart_status_options,
        inspection_groups,
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
        className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl font-logo text-xs text-[#F2F0EA]"
      >
        {sites.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      <div className="flex gap-1">
        {[
          { id: "prestart", label: "Pre-start" },
          { id: "mechanic", label: "Mechanic inspection" },
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
          <p className="text-[10px] text-[#F2F0EA]/50">One checklist item per line. Operators see these during pre-start.</p>
          <textarea
            value={prestartText}
            onChange={(e) => setPrestartText(e.target.value)}
            rows={12}
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
            Format: group lines start with ## Category. Item lines: Item name | Option1, Option2
          </p>
          <textarea
            value={groupsText}
            onChange={(e) => setGroupsText(e.target.value)}
            rows={16}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded text-[#F2F0EA] text-sm font-mono text-xs"
          />
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={busy || !siteId}
        className="w-full bg-[#00A4A6] text-white py-4 rounded-xl font-logo font-bold text-xs disabled:opacity-40"
      >
        SAVE CHECKLISTS
      </button>
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
