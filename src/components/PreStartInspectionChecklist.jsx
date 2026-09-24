import { useEffect } from "react";
import { PRESTART_INSPECTION_ITEMS, PRESTART_STATUS_OPTIONS } from "../lib/constants.js";
import { pickMedia } from "../lib/media.js";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import { FormSection } from "./ui/FormSection.jsx";
import { Button } from "./ui/Button.jsx";

export function PreStartInspectionChecklist({
  items = PRESTART_INSPECTION_ITEMS,
  statusOptions = PRESTART_STATUS_OPTIONS,
  results,
  remarks,
  photos,
  setResults,
  setRemarks,
  setPhotos,
  step = 0,
  setStep,
  onComplete,
}) {
  const total = items.length || 1;
  const index = Math.min(Math.max(Number(step) || 0, 0), Math.max(total - 1, 0));
  const item = items[index];
  const answered = !!results[item];
  const photo = photos[item];
  const flagged = results[item] === "Needs attention" || results[item] === statusOptions[statusOptions.length - 1];
  const last = index >= total - 1;
  const allDone = items.length > 0 && items.every((name) => results[name]);

  useEffect(() => {
    if (!items.length || !setStep) return;
    const firstOpen = items.findIndex((name) => !results[name]);
    if (firstOpen >= 0 && !results[items[index]]) {
      setStep(firstOpen);
    }
  }, []);

  const attachPhoto = () => {
    pickMedia("photo", ({ ref, data }) => {
      setPhotos((p) => ({ ...p, [item]: { ref, preview: data } }));
    });
  };

  const goNext = () => {
    if (!answered) return;
    if (last) {
      if (allDone) onComplete();
      return;
    }
    setStep?.(index + 1);
  };

  const goBack = () => {
    if (index > 0) setStep?.(index - 1);
  };

  return (
    <FormSection
      title="Pre-start check"
      description="One check at a time. Walk the machine, mark this item, then tap Next."
      accent="#F5C518"
    >
      <p className="font-ui text-base text-ops-text mb-2">
        Check {index + 1} of {total}
      </p>
      <div className="h-2 w-full bg-ops-border rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-ops-gold transition-all"
          style={{ width: `${total ? ((index + (answered ? 1 : 0)) / total) * 100 : 0}%` }}
        />
      </div>

      <p className="font-ui text-xl font-semibold text-ops-text leading-snug mb-5">{item}</p>

      <div className="grid grid-cols-1 gap-2 mb-4">
        {statusOptions.map((opt) => {
          const selected = results[item] === opt;
          const warn = opt === "Needs attention" || opt === statusOptions[statusOptions.length - 1];
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setResults((p) => ({ ...p, [item]: opt }))}
              className={`w-full min-h-[56px] px-4 py-3 rounded-2xl text-lg font-semibold border ${
                selected
                  ? warn
                    ? "bg-ops-gold text-ops-ink border-ops-gold"
                    : opt === "Action taken"
                      ? "bg-ops-teal text-white border-ops-teal"
                      : "bg-ops-green text-ops-ink border-ops-green"
                  : "bg-ops-elevated text-ops-text border-ops-border"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {flagged && (
        <p className="font-body text-base text-ops-gold mb-3">Add a comment or photo if something needs attention.</p>
      )}

      <VoiceInput
        value={remarks[item] || ""}
        onChange={(v) => setRemarks((p) => ({ ...p, [item]: v }))}
        placeholder="Comment (optional)…"
        rows={2}
      />

      <button
        type="button"
        onClick={attachPhoto}
        className={`mt-3 w-full min-h-[52px] py-3 rounded-2xl font-ui text-base font-semibold border ${
          photo?.preview
            ? "bg-ops-green/15 border-ops-green text-ops-green"
            : "bg-ops-elevated border-ops-border text-ops-text"
        }`}
      >
        {photo?.preview ? "Photo attached — tap to replace" : "Add photo (optional)"}
      </button>
      {photo?.preview && (
        <img src={photo.preview} alt="" className="w-full max-h-40 object-contain rounded-xl mt-3 border border-ops-border" />
      )}

      <div className="grid grid-cols-2 gap-3 mt-6">
        <Button type="button" variant="secondary" size="lg" onClick={goBack} disabled={index === 0}>
          Back
        </Button>
        <Button type="button" variant="primary" size="lg" className="font-logo" onClick={goNext} disabled={!answered}>
          {last ? "Finish checks" : "Next"}
        </Button>
      </div>
    </FormSection>
  );
}
