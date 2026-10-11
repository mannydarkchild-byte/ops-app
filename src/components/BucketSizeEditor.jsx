import { useEffect, useState } from "react";
import { updateSiteSettings } from "../services/admin.js";

export function BucketSizeEditor({ siteId, settings, onSaved, showAlert }) {
  const [excavator, setExcavator] = useState("");
  const [fel, setFel] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setExcavator(settings?.excavator_bucket_tonnes ?? "");
    setFel(settings?.fel_bucket_tonnes ?? "");
  }, [siteId, settings?.excavator_bucket_tonnes, settings?.fel_bucket_tonnes]);

  const parse = (raw, label) => {
    const text = String(raw ?? "").trim();
    if (!text) return null;
    const n = Number(text);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} must be more than 0.`);
    return n;
  };

  const save = async () => {
    if (!siteId) return;
    setBusy(true);
    try {
      const excavator_bucket_tonnes = parse(excavator, "Tonnes per excavator bucket");
      const fel_bucket_tonnes = parse(fel, "Tonnes per FEL bucket");
      await updateSiteSettings(siteId, { excavator_bucket_tonnes, fel_bucket_tonnes });
      await onSaved?.();
      showAlert?.("Saved", "Bucket size saved. Screened tonnes and floor stock use these sizes.");
    } catch (e) {
      showAlert?.("Could not save", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="font-body text-sm text-[#F2F0EA]/70">
        Excavator buckets become screened tonnes. FEL buckets go onto the floor. A later change does not rewrite a day that already saved its own size.
      </p>
      <label className="block">
        <span className="font-logo text-[10px] text-[#F2F0EA]/50 tracking-wider">TONNES PER EXCAVATOR BUCKET</span>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="Not set"
          value={excavator}
          onChange={(e) => setExcavator(e.target.value)}
          className="mt-1 w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]"
        />
      </label>
      <label className="block">
        <span className="font-logo text-[10px] text-[#F2F0EA]/50 tracking-wider">TONNES PER FEL BUCKET</span>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="Not set"
          value={fel}
          onChange={(e) => setFel(e.target.value)}
          className="mt-1 w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]"
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={busy || !siteId}
        className="w-full py-3 rounded-full bg-[#F5C518] text-black font-logo font-bold disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save bucket size"}
      </button>
    </div>
  );
}
