import { INSPECTION_GROUPS, getMechanicInspectionItems } from "../lib/constants.js";
import { pickMedia } from "../lib/media.js";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import { FormSection } from "./ui/FormSection.jsx";

export function InspectionChecklist({ results, remarks, photos, setResults, setRemarks, setPhotos, onComplete, machineName }) {
  const allItems = getMechanicInspectionItems();
  const done = allItems.filter((item) => results[item.item_name]).length;
  const flagged = allItems.filter((item) => {
    const status = results[item.item_name];
    return status && !["Good", "OK", "Working", "Pass", "Present", "None"].includes(status);
  }).length;
  const allDone = done === allItems.length;

  const attachPhoto = (itemName) => {
    pickMedia("photo", ({ ref, data }) => {
      setPhotos((p) => ({ ...p, [itemName]: { ref, preview: data } }));
    });
  };

  return (
    <FormSection
      step={1}
      title="Full machine inspection"
      description={machineName ? `${machineName} — check every item below. Photos are included on the inspection report.` : "Check every item below. Photos are included on the inspection report."}
      accent="#00A4A6"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="font-body text-xs text-[#F2F0EA]/50">{done} of {allItems.length} complete</p>
        <div className="h-2 w-20 bg-[#2A2A2A] rounded-full overflow-hidden">
          <div className="h-full bg-[#00A4A6] transition-all" style={{ width: `${(done / allItems.length) * 100}%` }} />
        </div>
      </div>

      {flagged > 0 && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-[#F97316]/10 border border-[#F97316]/30">
          <p className="font-logo text-[10px] text-[#F97316] tracking-wider">{flagged} item(s) need attention — add photos where useful</p>
        </div>
      )}

      <div className="max-h-[55vh] overflow-y-auto space-y-4 pr-1">
        {INSPECTION_GROUPS.map((group) => (
          <div key={group.category} className="bg-[#141414] rounded-xl p-3 border border-[#2A2A2A]">
            <h3 className="font-logo text-sm text-[#00A4A6] mb-3">{group.icon} {group.category}</h3>
            {group.items.map(([item, options]) => {
              const photo = photos[item];
              return (
                <div key={item} className="mb-3 pb-3 border-b border-[#2A2A2A] last:border-0 last:mb-0 last:pb-0">
                  <p className="font-body text-sm mb-2">{item}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setResults((p) => ({ ...p, [item]: opt }))}
                        className={`px-2.5 py-1.5 rounded text-[10px] font-logo tracking-wide ${
                          results[item] === opt ? "bg-[#F5C518] text-black" : "bg-[#2A2A2A] text-[#F2F0EA]/70"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <VoiceInput value={remarks[item] || ""} onChange={(v) => setRemarks((p) => ({ ...p, [item]: v }))} placeholder="Remark (optional)…" rows={1} />
                  <button
                    type="button"
                    onClick={() => attachPhoto(item)}
                    className={`mt-2 w-full py-2 rounded-lg font-logo text-[10px] tracking-wider border active:scale-[0.99] ${
                      photo?.preview
                        ? "bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]"
                        : "bg-[#0A0A0A] border-[#2A2A2A] text-[#F2F0EA]/50"
                    }`}
                  >
                    {photo?.preview ? "✓ PHOTO ATTACHED" : "📷 ADD PHOTO (OPTIONAL)"}
                  </button>
                  {photo?.preview && (
                    <img src={photo.preview} alt="" className="w-full max-h-32 object-contain rounded-lg mt-2 border border-[#2A2A2A]" />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onComplete}
        disabled={!allDone}
        className="w-full mt-4 bg-[#00A4A6] text-white py-4 rounded-xl font-logo font-bold text-lg tracking-wider disabled:opacity-40"
      >
        {allDone ? "SUBMIT INSPECTION" : `COMPLETE ALL ${allItems.length} ITEMS FIRST`}
      </button>
    </FormSection>
  );
}
