import { useMemo, useState } from "react";
import { INSPECTION_GROUPS, getMechanicInspectionItems } from "../lib/constants.js";
import { getMechanicItemsFromGroups } from "../lib/siteConfig.js";
import { pickMedia } from "../lib/media.js";
import { VoiceInput } from "./ui/VoiceInput.jsx";

const OK_STATUSES = new Set(["Good", "OK", "Working", "Pass", "Present", "None"]);

function statusTone(opt, selected) {
  if (selected !== opt) return "bg-[#1A1A1A] border-[#2A2A2A] text-[#F2F0EA]/70";
  if (OK_STATUSES.has(opt)) return "bg-[#22C55E] border-[#22C55E] text-black";
  if (["Attention", "Worn", "Dirty", "Low", "Minor", "Found", "Observed", "Faulty", "Faded"].includes(opt)) {
    return "bg-[#F97316] border-[#F97316] text-black";
  }
  return "bg-[#EF4444] border-[#EF4444] text-white";
}

export function MechanicInspectionWizard({
  machineName,
  groups,
  results,
  remarks,
  photos,
  setResults,
  setRemarks,
  setPhotos,
  step: stepProp,
  setStep: setStepProp,
  mode: modeProp,
  setMode: setModeProp,
  onComplete,
  onCancel,
  busy = false,
}) {
  const items = useMemo(
    () => (groups ? getMechanicItemsFromGroups(groups) : getMechanicInspectionItems()),
    [groups]
  );
  const [stepLocal, setStepLocal] = useState(0);
  const [modeLocal, setModeLocal] = useState("walk");
  const step = stepProp ?? stepLocal;
  const setStep = setStepProp ?? setStepLocal;
  const mode = modeProp ?? modeLocal;
  const setMode = setModeProp ?? setModeLocal;
  const [showExtras, setShowExtras] = useState(false);

  const doneCount = items.filter((i) => results[i.item_name]).length;
  const current = items[step];
  const currentName = current?.item_name;
  const currentStatus = currentName ? results[currentName] : null;
  const currentPhoto = currentName ? photos[currentName] : null;
  const isLast = step === items.length - 1;

  const flagged = useMemo(
    () => items.filter((i) => results[i.item_name] && !OK_STATUSES.has(results[i.item_name])),
    [items, results]
  );

  const incomplete = useMemo(
    () => items.filter((i) => !results[i.item_name]),
    [items, results]
  );

  const categoryProgress = useMemo(() => {
    return INSPECTION_GROUPS.map((group) => {
      const names = group.items.map(([name]) => name);
      const done = names.filter((n) => results[n]).length;
      return { ...group, done, total: names.length };
    });
  }, [results]);

  const attachPhoto = () => {
    if (!currentName) return;
    pickMedia("photo", ({ ref, data }) => {
      setPhotos((p) => ({ ...p, [currentName]: { ref, preview: data } }));
      setShowExtras(true);
    });
  };

  const pickStatus = (opt) => {
    if (!currentName) return;
    setResults((p) => ({ ...p, [currentName]: opt }));
    if (!OK_STATUSES.has(opt)) setShowExtras(true);
  };

  const goNext = () => {
    if (!currentStatus) return;
    if (isLast) {
      setMode("review");
      return;
    }
    setStep((s) => s + 1);
    setShowExtras(false);
  };

  const goPrev = () => {
    if (mode === "review") {
      setMode("walk");
      setStep(items.length - 1);
      return;
    }
    if (step > 0) {
      setStep((s) => s - 1);
      setShowExtras(false);
    }
  };

  const jumpToCategory = (category) => {
    const idx = items.findIndex((i) => i.category === category);
    if (idx >= 0) {
      setMode("walk");
      setStep(idx);
      setShowExtras(false);
    }
  };

  if (mode === "review") {
    return (
      <div className="fixed inset-0 z-50 bg-[#0A0A0A] text-[#F2F0EA] flex flex-col mobile-safe-bottom">
        <header className="px-4 pt-4 pb-3 border-b border-[#2A2A2A]">
          <p className="font-logo text-[10px] text-[#00A4A6] tracking-wider">REVIEW BEFORE SUBMIT</p>
          <h1 className="font-logo text-lg text-[#F5C518] mt-1">{machineName || "Inspection"}</h1>
          <p className="text-xs text-[#F2F0EA]/50 mt-1">{doneCount} of {items.length} items answered</p>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {incomplete.length > 0 && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-3">
              <p className="font-logo text-xs text-[#EF4444] mb-2">{incomplete.length} item(s) still need an answer</p>
              {incomplete.slice(0, 6).map((i) => (
                <button
                  key={i.item_name}
                  type="button"
                  onClick={() => { setMode("walk"); setStep(items.findIndex((x) => x.item_name === i.item_name)); }}
                  className="block w-full text-left text-xs text-[#F2F0EA]/80 py-1 underline"
                >
                  {i.category} · {i.item_name}
                </button>
              ))}
            </div>
          )}

          {flagged.length > 0 && (
            <div className="bg-[#F97316]/10 border border-[#F97316]/30 rounded-xl p-3">
              <p className="font-logo text-xs text-[#F97316] mb-2">{flagged.length} flagged for attention</p>
              {flagged.map((i) => (
                <p key={i.item_name} className="text-xs text-[#F2F0EA]/70 py-0.5">
                  {i.item_name} — <span className="text-[#F97316]">{results[i.item_name]}</span>
                </p>
              ))}
            </div>
          )}

          <div>
            <p className="font-logo text-[10px] text-[#F2F0EA]/50 mb-2 tracking-wider">BY SECTION</p>
            <div className="space-y-2">
              {categoryProgress.map((g) => (
                <button
                  key={g.category}
                  type="button"
                  onClick={() => jumpToCategory(g.category)}
                  className="w-full flex items-center justify-between bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-2.5 active:border-[#00A4A6]"
                >
                  <span className="font-logo text-xs">{g.icon} {g.category}</span>
                  <span className={`text-[10px] font-logo ${g.done === g.total ? "text-[#22C55E]" : "text-[#F2F0EA]/50"}`}>
                    {g.done}/{g.total}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="p-4 border-t border-[#2A2A2A] bg-[#0A0A0A] grid grid-cols-2 gap-3">
          <button type="button" onClick={goPrev} className="border border-[#2A2A2A] py-4 rounded-xl font-logo text-sm">
            ← BACK
          </button>
          <button
            type="button"
            onClick={onComplete}
            disabled={busy || incomplete.length > 0}
            className="bg-[#00A4A6] text-white py-4 rounded-xl font-logo font-bold disabled:opacity-40"
          >
            {busy ? "SUBMITTING…" : "SUBMIT"}
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0A] text-[#F2F0EA] flex flex-col mobile-safe-bottom">
      <header className="px-4 pt-4 pb-2 border-b border-[#2A2A2A]">
        <div className="flex justify-between items-start gap-2 mb-2">
          <div className="min-w-0">
            <p className="font-logo text-[10px] text-[#00A4A6] tracking-wider truncate">{current?.category}</p>
            <p className="text-[10px] text-[#F2F0EA]/40 mt-0.5">{machineName}</p>
          </div>
          <button type="button" onClick={onCancel} className="text-[#F2F0EA]/40 text-xl leading-none px-2">×</button>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
            <div className="h-full bg-[#00A4A6] transition-all" style={{ width: `${((step + 1) / items.length) * 100}%` }} />
          </div>
          <span className="font-logo text-[10px] text-[#F2F0EA]/50 whitespace-nowrap">{step + 1}/{items.length}</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5">
        <p className="font-body text-lg leading-snug mb-6">{currentName}</p>

        <p className="font-logo text-[10px] text-[#F2F0EA]/50 mb-3 tracking-wider">TAP ONE ANSWER</p>
        <div className="grid grid-cols-1 gap-2 mb-4">
          {current?.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => pickStatus(opt)}
              className={`w-full min-h-[52px] px-4 py-3 rounded-xl border-2 font-logo text-sm tracking-wide active:scale-[0.98] transition-transform ${statusTone(opt, currentStatus)}`}
            >
              {opt}
              {currentStatus === opt && <span className="ml-2">✓</span>}
            </button>
          ))}
        </div>

        {currentStatus && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowExtras(!showExtras)}
              className="w-full text-left font-logo text-[10px] text-[#F2F0EA]/50 tracking-wider py-2"
            >
              {showExtras ? "▾" : "▸"} NOTE OR PHOTO {currentPhoto?.preview ? "· photo attached" : ""}
            </button>
            {showExtras && (
              <div className="space-y-2 pb-4">
                <VoiceInput
                  value={remarks[currentName] || ""}
                  onChange={(v) => setRemarks((p) => ({ ...p, [currentName]: v }))}
                  placeholder="Remark (optional)…"
                  rows={2}
                />
                <button
                  type="button"
                  onClick={attachPhoto}
                  className={`w-full py-3 rounded-xl font-logo text-xs border ${
                    currentPhoto?.preview
                      ? "bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]"
                      : "border-[#2A2A2A] text-[#F2F0EA]/60"
                  }`}
                >
                  {currentPhoto?.preview ? "✓ PHOTO ATTACHED — TAP TO REPLACE" : "📷 ADD PHOTO"}
                </button>
                {currentPhoto?.preview && (
                  <img src={currentPhoto.preview} alt="" className="w-full max-h-40 object-contain rounded-xl border border-[#2A2A2A]" />
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="p-4 border-t border-[#2A2A2A] bg-[#0A0A0A]">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center mb-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={step === 0}
            className="border border-[#2A2A2A] py-3 rounded-xl font-logo text-xs disabled:opacity-30"
          >
            ← PREV
          </button>
          <button
            type="button"
            onClick={() => setMode("review")}
            className="font-logo text-[10px] text-[#F5C518] px-2 py-1"
          >
            REVIEW ({doneCount}/{items.length})
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!currentStatus}
            className="bg-[#F5C518] text-black py-3 rounded-xl font-logo font-bold text-xs disabled:opacity-40"
          >
            {isLast ? "REVIEW →" : "NEXT →"}
          </button>
        </div>
        <p className="text-center text-[10px] text-[#F2F0EA]/30 font-logo">
          One item at a time — answer before moving on
        </p>
      </footer>
    </div>
  );
}
