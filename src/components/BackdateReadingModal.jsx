import { useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { FormSection } from "./ui/FormSection.jsx";
import { MeterPhoto } from "./ui/MeterPhoto.jsx";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import * as wf from "../services/workflows.js";

/** Admin / Manager only — backdated hour meter entry */
export function BackdateReadingModal({ onClose, user, machine, site, onDone }) {
  const [reading, setReading] = useState("");
  const [photoRef, setPhotoRef] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [readingAt, setReadingAt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reading || !readingAt) return;
    setBusy(true);
    try {
      await wf.recordHourReading(user, machine, site, {
        reading,
        photoRef,
        readingAt: new Date(readingAt).toISOString(),
        source: "backdated",
        notes: notes || "Backdated entry (admin/manager)",
      });
      await onDone?.();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="BACKDATE HOUR READING" color="blue" onClose={onClose}>
      <FormSection
        step={1}
        title="Machine & site"
        description={`Recording for ${machine?.name || "machine"} at ${site?.name || "site"}. Use only when correcting a missed reading.`}
        accent="#00A4A6"
      >
        <p className="font-logo text-xs text-[#F2F0EA]/70">{machine?.name} · {site?.name}</p>
      </FormSection>

      <FormSection
        step={2}
        title="Meter reading"
        description="Enter the hour meter reading for the backdated date. Add a photo if you have one — optional when correcting old entries."
        accent="#00A4A6"
      >
        <MeterPhoto
          value={reading}
          onValue={setReading}
          photo={photoPreview}
          onPhoto={(ref, preview) => { setPhotoRef(ref); setPhotoPreview(preview); }}
          required={false}
          hint="Type the reading from records or the meter. Photo is optional for backdated entries."
          allowBackdate
          readingAt={readingAt}
          onReadingAt={setReadingAt}
        />
      </FormSection>

      <FormSection step={3} title="Reason" description="Why this reading is being backdated." accent="#00A4A6">
        <VoiceInput value={notes} onChange={setNotes} placeholder="Reason for backdate…" rows={2} />
      </FormSection>

      <button type="button" onClick={submit} disabled={busy || !reading || !readingAt}
        className="w-full bg-[#00A4A6] text-white py-4 rounded-xl font-logo font-bold disabled:opacity-40">
        {busy ? "SAVING…" : "SAVE BACKDATED READING"}
      </button>
    </Modal>
  );
}
