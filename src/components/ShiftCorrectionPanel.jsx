import { useState } from "react";
import { MeterPhoto } from "./ui/MeterPhoto.jsx";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import { fmtDateShort } from "../lib/utils.js";
import * as wf from "../services/workflows.js";

/** Operator must fix and resubmit after supervisor requests correction */
export function ShiftCorrectionPanel({ shift, machine, site, user, onDone, onResubmitted }) {
  const [endHour, setEndHour] = useState(String(shift.end_hour_meter ?? ""));
  const [endPhotoRef, setEndPhotoRef] = useState(null);
  const [endPhotoPreview, setEndPhotoPreview] = useState(null);
  const [endPhotoError, setEndPhotoError] = useState(false);
  const [operatorNote, setOperatorNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleResubmit = async () => {
    if (!endPhotoRef) {
      setEndPhotoError(true);
      setError("Take a new photo of the closing hour meter.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const updated = await wf.resubmitShiftAfterCorrection(user, machine, site, shift, {
        endHour,
        photoRef: endPhotoRef,
        operatorNote: operatorNote.trim(),
      });
      await onDone?.();
      onResubmitted?.(updated);
    } catch (e) {
      setError(e.message || "Could not resubmit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#141414] border-2 border-[#F97316] rounded-2xl p-5 sm:p-6">
      <div className="text-center mb-4">
        <p className="font-logo text-2xl text-[#F97316] tracking-wider mb-1">CORRECTION REQUIRED</p>
        <p className="text-base text-[#F2F0EA]/70">
          Your supervisor sent this shift back. Fix the issue below and resubmit.
        </p>
      </div>

      <div className="bg-[#F97316]/10 border border-[#F97316]/40 rounded-xl p-4 mb-4">
        <p className="font-logo text-sm text-[#F97316] mb-2">Supervisor says:</p>
        <p className="text-base text-[#F2F0EA] leading-relaxed whitespace-pre-wrap">
          {shift.supervisor_comment || "Please review and correct your shift report."}
        </p>
      </div>

      <div className="space-y-2 mb-4 text-base text-[#F2F0EA]/80">
        <p><span className="text-[#F2F0EA]/50">Date:</span> {fmtDateShort(shift.started_at)}</p>
        <p><span className="text-[#F2F0EA]/50">Machine:</span> {machine?.name || "—"}</p>
        <p><span className="text-[#F2F0EA]/50">Current meter:</span> {shift.start_hour_meter}h → {shift.end_hour_meter}h</p>
        <p><span className="text-[#F2F0EA]/50">Billable hours submitted:</span> {Number(shift.hours_worked || 0).toFixed(1)}h</p>
      </div>

      <label className="block font-logo text-sm text-[#F2F0EA] mb-2">Corrected closing hour meter</label>
      <MeterPhoto
        value={endHour}
        onValue={setEndHour}
        photo={endPhotoPreview}
        onPhoto={(ref, preview) => {
          setEndPhotoRef(ref);
          setEndPhotoPreview(preview);
          setEndPhotoError(false);
          setError("");
        }}
        showPhotoError={endPhotoError}
      />

      <label className="block font-logo text-sm text-[#F2F0EA] mb-2 mt-4">What did you fix? (optional)</label>
      <VoiceInput
        value={operatorNote}
        onChange={setOperatorNote}
        placeholder="Explain what you corrected…"
        rows={3}
      />

      {error && <p className="text-[#EF4444] text-base mt-3">{error}</p>}

      <button
        type="button"
        onClick={handleResubmit}
        disabled={busy || !endHour || !endPhotoRef}
        className="w-full mt-4 bg-[#F97316] text-black py-4 rounded-xl font-logo font-bold text-base disabled:opacity-40"
      >
        {busy ? "RESUBMITTING…" : "RESUBMIT TO SUPERVISOR"}
      </button>

      <p className="text-sm text-[#F2F0EA]/45 text-center mt-3">
        You cannot start a new shift until this is resubmitted.
      </p>
    </div>
  );
}
