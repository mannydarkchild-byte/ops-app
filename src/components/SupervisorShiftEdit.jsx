import { useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { Button } from "./ui/Button.jsx";
import { MeterPhoto } from "./ui/MeterPhoto.jsx";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import { editShiftBeforeSign } from "../services/workflows.js";

/** Supervisor can correct meters or photos before signing, instead of sending the operator back. */
export function SupervisorShiftEdit({ shift, user, onClose, onDone }) {
  const [startHour, setStartHour] = useState(String(shift.start_hour_meter ?? ""));
  const [endHour, setEndHour] = useState(String(shift.end_hour_meter ?? ""));
  const [openingRef, setOpeningRef] = useState(null);
  const [openingPreview, setOpeningPreview] = useState(null);
  const [closingRef, setClosingRef] = useState(null);
  const [closingPreview, setClosingPreview] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const updated = await editShiftBeforeSign(user, shift, {
        startHour,
        endHour,
        openingPhotoRef: openingRef,
        closingPhotoRef: closingRef,
        note,
      });
      onDone?.(updated);
      onClose?.();
    } catch (e) {
      setError(e.message || "Could not save the report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Edit report" color="yellow" onClose={onClose}>
      <p className="font-body text-sm text-[#F2F0EA]/70 mb-4">
        Correct the meters here, or send the report back if the operator must fix it.
      </p>
      <p className="font-ui text-sm font-semibold text-ops-text mb-2">Opening meter</p>
      <MeterPhoto
        value={startHour}
        onValue={setStartHour}
        photo={openingPreview}
        onPhoto={(ref, data) => { setOpeningRef(ref); setOpeningPreview(data); }}
        required={false}
        hint="Leave the photo blank if only the number needs a fix."
      />
      <p className="font-ui text-sm font-semibold text-ops-text mb-2 mt-4">Closing meter</p>
      <MeterPhoto
        value={endHour}
        onValue={setEndHour}
        photo={closingPreview}
        onPhoto={(ref, data) => { setClosingRef(ref); setClosingPreview(data); }}
        required={false}
        hint="Leave the photo blank if only the number needs a fix."
      />
      <p className="font-ui text-sm font-semibold text-ops-text mb-2 mt-4">What did you change?</p>
      <VoiceInput
        value={note}
        onChange={setNote}
        placeholder="Optional note on this edit…"
        rows={2}
      />
      {error && <p className="font-body text-sm text-[#EF4444] mt-3">{error}</p>}
      <Button className="w-full mt-4" size="lg" disabled={busy || startHour === ""} onClick={save}>
        {busy ? "Saving…" : "Save and keep for sign-off"}
      </Button>
    </Modal>
  );
}
