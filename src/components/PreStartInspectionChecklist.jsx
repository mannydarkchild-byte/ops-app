import { PRESTART_INSPECTION_ITEMS, PRESTART_STATUS_OPTIONS } from "../lib/constants.js";
import { pickMedia } from "../lib/media.js";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import { FormSection } from "./ui/FormSection.jsx";

export function PreStartInspectionChecklist({
  items = PRESTART_INSPECTION_ITEMS,
  statusOptions = PRESTART_STATUS_OPTIONS,
  results, remarks, photos, setResults, setRemarks, setPhotos, onComplete,
}) {
  const done = items.filter((item) => results[item]).length;
  const needsAttention = items.filter((item) => results[item] === "Needs attention").length;
  const allDone = done === items.length;

  const attachPhoto = (item) => {
    pickMedia("photo", ({ ref, data }) => {
      setPhotos((p) => ({ ...p, [item]: { ref, preview: data } }));
    });
  };

  return (
    <FormSection
      step={2}
      title="Pre-start inspection"
      description="Walk around the machine and check each item. Add a photo where something needs documenting — photos appear on the shift report."
      accent="#F5C518"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="font-body text-xs text-[#F2F0EA]/50">{done} of {items.length} complete</p>
        <div className="h-2 w-20 bg-[#2A2A2A] rounded-full overflow-hidden">
          <div className="h-full bg-[#F5C518] transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </div>
      </div>

      {needsAttention > 0 && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-[#F5C518]/10 border border-[#F5C518]/30">
          <p className="font-logo text-[10px] text-[#F5C518] tracking-wider">{needsAttention} item(s) flagged — add photos and comments</p>
        </div>
      )}

      <div className="max-h-[45vh] overflow-y-auto space-y-3 pr-1">
        {items.map((item, idx) => {
          const photo = photos[item];
          const flagged = results[item] === "Needs attention" || results[item] === statusOptions[statusOptions.length - 1];
          return (
            <div key={item} className={`bg-[#141414] rounded-xl p-3 border ${flagged ? "border-[#F5C518]/40" : "border-[#2A2A2A]"}`}>
              <p className="font-logo text-[10px] text-[#00A4A6] mb-1">ITEM {idx + 1} OF {items.length}</p>
              <p className="font-body text-sm mb-2">{item}</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {statusOptions.map((opt) => (
                  <button key={opt} type="button" onClick={() => setResults((p) => ({ ...p, [item]: opt }))}
                    className={`px-3 py-2 rounded-lg text-[11px] font-semibold leading-tight ${
                      results[item] === opt
                        ? opt === "Needs attention" || opt === statusOptions[statusOptions.length - 1] ? "bg-[#F5C518] text-black" : opt === "Action taken" ? "bg-[#00A4A6] text-white" : "bg-[#22C55E] text-black"
                        : "bg-[#2A2A2A] text-[#F2F0EA]/70"
                    }`}>
                    {opt}
                  </button>
                ))}
              </div>
              <VoiceInput
                value={remarks[item] || ""}
                onChange={(v) => setRemarks((p) => ({ ...p, [item]: v }))}
                placeholder="Comment (optional)…"
                rows={1}
              />
              <button
                type="button"
                onClick={() => attachPhoto(item)}
                className={`mt-2 w-full py-2.5 rounded-lg font-logo text-[10px] tracking-wider border active:scale-[0.99] ${
                  photo?.preview
                    ? "bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]"
                    : "bg-[#0A0A0A] border-[#2A2A2A] text-[#F2F0EA]/50"
                }`}
              >
                {photo?.preview ? "✓ PHOTO ATTACHED — TAP TO REPLACE" : "📷 ADD PHOTO (OPTIONAL)"}
              </button>
              {photo?.preview && (
                <img src={photo.preview} alt="" className="w-full max-h-36 object-contain rounded-lg mt-2 border border-[#2A2A2A]" />
              )}
            </div>
          );
        })}
      </div>

      <button type="button" onClick={onComplete} disabled={!allDone}
        className="w-full mt-4 bg-[#F5C518] text-black py-4 rounded-xl font-logo font-bold text-lg tracking-wider disabled:opacity-40">
        {allDone ? "COMPLETE PRE-START" : `COMPLETE ALL ${items.length} ITEMS FIRST`}
      </button>
    </FormSection>
  );
}
