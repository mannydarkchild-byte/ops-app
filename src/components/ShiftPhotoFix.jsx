import { useState } from "react";
import { MeterPhoto } from "./ui/MeterPhoto.jsx";
import { replaceShiftMeterPhoto } from "../services/workflows.js";
import { SHIFT } from "../lib/constants.js";
import { getShiftStatus } from "../lib/utils.js";

/** Replace a blurry hour-meter photo on a shift that is not yet signed off. */
export function ShiftPhotoFix({ shift, user, onDone }) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState("closing");
  const [photoRef, setPhotoRef] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [reading, setReading] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!shift || getShiftStatus(shift) === SHIFT.VERIFIED) return null;

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const updated = await replaceShiftMeterPhoto(user, shift, { side, photoRef, reading });
      setOpen(false);
      setPhotoRef(null);
      setPhotoPreview(null);
      setReading("");
      onDone?.(updated);
    } catch (e) {
      setError(e.message || "Could not replace that photo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full border-2 border-[#F5C518] text-[#F5C518] py-4 rounded-xl font-logo"
        >
          Meter photo is blurry — replace it
        </button>
      ) : (
        <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-4 text-left">
          <p className="font-logo text-[#F5C518] mb-3">Replace meter photo</p>
          <p className="font-body text-[#F2F0EA]/70 mb-3">
            Camera first. You can also pick a clearer photo already on this phone.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => setSide("opening")}
              className={`ops-chip rounded-xl font-logo ${side === "opening" ? "bg-[#F5C518] text-black" : "border border-[#2A2A2A] text-[#F2F0EA]"}`}
            >
              Opening
            </button>
            <button
              type="button"
              onClick={() => setSide("closing")}
              className={`ops-chip rounded-xl font-logo ${side === "closing" ? "bg-[#F5C518] text-black" : "border border-[#2A2A2A] text-[#F2F0EA]"}`}
            >
              Closing
            </button>
          </div>
          <MeterPhoto
            value={reading}
            onValue={setReading}
            photo={photoPreview}
            onPhoto={(ref, data) => { setPhotoRef(ref); setPhotoPreview(data); }}
            hint="Take a clear photo, then type the reading if it also needs a fix."
            required
          />
          {error && <p className="font-body text-[#EF4444] mt-2">{error}</p>}
          <button
            type="button"
            disabled={busy || !photoRef}
            onClick={save}
            className="w-full mt-3 bg-[#F5C518] text-black py-4 rounded-xl font-logo font-bold disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save clearer photo"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full mt-2 border border-[#2A2A2A] text-[#F2F0EA]/70 py-3 rounded-xl font-logo"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
