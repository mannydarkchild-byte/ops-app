import { useEffect } from "react";
import { PRESTART_INSPECTION_ITEMS, PRESTART_STATUS_GUIDE, PRESTART_STATUS_OPTIONS } from "../lib/constants.js";
import { asPhotoList } from "../lib/inspectionDraft.js";
import { pickMedia } from "../lib/media.js";
import { ChoiceHint, statusGuide } from "./ui/ChoiceHint.jsx";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import { FormSection } from "./ui/FormSection.jsx";
import { Button } from "./ui/Button.jsx";

const MAX_PHOTOS = 4;

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
  onReportProblem,
}) {
  const total = items.length || 1;
  const index = Math.min(Math.max(Number(step) || 0, 0), Math.max(total - 1, 0));
  const item = items[index];
  const answered = !!results[item];
  const photoList = asPhotoList(photos[item]);
  const lastOption = statusOptions[statusOptions.length - 1];
  const flagged = results[item] === "Needs attention" || results[item] === lastOption;
  const actionTaken = results[item] === "Action taken";
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
    if (photoList.length >= MAX_PHOTOS) return;
    pickMedia("photo", ({ ref, data }) => {
      setPhotos((p) => ({ ...p, [item]: [...asPhotoList(p[item]), { ref, preview: data }] }));
    });
  };

  const removePhoto = (idx) => {
    setPhotos((p) => ({
      ...p,
      [item]: asPhotoList(p[item]).filter((_, i) => i !== idx),
    }));
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
      <p className="font-ui text-lg text-ops-text mb-2">
        Check {index + 1} of {total}
      </p>
      <div className="h-2.5 w-full bg-ops-border rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-ops-gold transition-all"
          style={{ width: `${total ? ((index + (answered ? 1 : 0)) / total) * 100 : 0}%` }}
        />
      </div>

      <p className="font-ui text-2xl font-semibold text-ops-text leading-snug mb-5">{item}</p>

      <div className="grid grid-cols-1 gap-2 mb-2">
        {statusOptions.map((opt) => {
          const selected = results[item] === opt;
          const warn = opt === "Needs attention" || opt === lastOption;
          return (
            <div key={opt}>
              <button
                type="button"
                onClick={() => setResults((p) => ({ ...p, [item]: opt }))}
                className={`w-full min-h-[64px] px-4 py-4 rounded-2xl text-xl font-semibold border ${
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
              {selected && (
                <ChoiceHint>
                  {statusGuide(PRESTART_STATUS_GUIDE, opt, "This choice is saved on the check.")}
                </ChoiceHint>
              )}
            </div>
          );
        })}
      </div>

      {(flagged || actionTaken) && (
        <>
          <VoiceInput
            value={remarks[item] || ""}
            onChange={(v) => setRemarks((p) => ({ ...p, [item]: v }))}
            placeholder={flagged ? "What is wrong?" : "What did you fix?"}
            rows={3}
          />

          <div className="mt-3 grid grid-cols-2 gap-2">
            {photoList.map((p, idx) => (
              <div key={`${p.ref || idx}`} className="relative">
                {p.preview && (
                  <img src={p.preview} alt="" className="w-full h-32 object-cover rounded-xl border border-ops-border" />
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute top-1 right-1 min-h-0 px-2 py-1 rounded-lg bg-black/70 text-white text-sm font-ui"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {photoList.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={attachPhoto}
              className="mt-3 w-full min-h-[56px] py-3 rounded-2xl font-ui text-lg font-semibold border bg-ops-elevated border-ops-border text-ops-text"
            >
              {photoList.length ? `Add another photo (${photoList.length}/${MAX_PHOTOS})` : "Add photo"}
            </button>
          )}

          {flagged && onReportProblem && (
            <button
              type="button"
              onClick={() => onReportProblem({
                item,
                remark: remarks[item] || "",
                photos: photoList,
              })}
              className="mt-3 w-full min-h-[56px] py-3 rounded-2xl font-logo text-base bg-[#EF4444] text-white"
            >
              Report this as a problem
            </button>
          )}
        </>
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
