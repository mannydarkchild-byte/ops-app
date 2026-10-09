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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setText(serializeStopReasons(settings.stop_reasons));
  }, [settings.stop_reasons, siteId]);

  const save = async () => {
    if (!siteId) return;
    setBusy(true);
    try {
      const stop_reasons = parseStopReasonsText(text);
      if (!stop_reasons.length) throw new Error("Add at least one stop reason");
      await updateSiteSettings(siteId, { stop_reasons });
      await onSaved?.();
      showAlert?.("Saved", "Stop reasons and owners updated for this site.");
    } catch (e) {
      showAlert?.("Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const resetDefaults = () => {
    setText(serializeStopReasons(null));
  };

  return (
    <div className="space-y-3">
      <p className="font-body text-xs text-[#F2F0EA]/55">
        One line per reason: <span className="text-[#F5C518]">Reason | Owner</span>.
        Darkchild owns mechanical, engine, hydraulic, and electrical stops. Berlington owns wear and consumables. Site owns feed, weather, and waiting.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
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
