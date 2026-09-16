import { useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { FormSection } from "./ui/FormSection.jsx";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import { TANK_LEVELS } from "../lib/constants.js";
import { pickMedia } from "../lib/media.js";
import * as wf from "../services/workflows.js";

export function FuelModal({ onClose, currentMeter, user, machine, site, shiftId, onDone }) {
  const [litres, setLitres] = useState("");
  const [hourMeter, setHourMeter] = useState(currentMeter || "");
  const [tankLevel, setTankLevel] = useState("Full");
  const [note, setNote] = useState("");
  const [pumpRef, setPumpRef] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!litres || !hourMeter) return;
    setBusy(true);
    try {
      await wf.addFuelLog(user, machine, site, shiftId, {
        litres, hourMeter, tankLevel, note, photoPumpRef: pumpRef,
      });
      await onDone?.();
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <Modal title="LOG DIESEL" color="yellow" onClose={onClose}>
      <FormSection step={1} title="Fuel amount" description="Litres pumped into the machine tank." accent="#F5C518">
        <input type="number" step="0.1" value={litres} onChange={(e) => setLitres(e.target.value)} placeholder="Litres"
          className="w-full bg-[#0A0A0A] border p-3 rounded text-[#F2F0EA] text-xl" />
      </FormSection>

      <FormSection step={2} title="Hour meter at fill" description="Reading on the machine meter when fuel was added." accent="#F5C518">
        <input type="number" step="0.1" value={hourMeter} onChange={(e) => setHourMeter(e.target.value)} placeholder="Hour meter (h)"
          className="w-full bg-[#0A0A0A] border p-3 rounded text-[#F2F0EA] text-xl" />
        <select value={tankLevel} onChange={(e) => setTankLevel(e.target.value)} className="w-full bg-[#0A0A0A] border p-3 rounded mt-2 text-[#F2F0EA]">
          {TANK_LEVELS.map((x) => <option key={x}>{x}</option>)}
        </select>
      </FormSection>

      <FormSection step={3} title="Pump receipt / photo" description="Photo of pump meter or dipstick (recommended)." accent="#F5C518">
        <button type="button" onClick={() => pickMedia("photo", ({ ref }) => setPumpRef(ref))}
          className="w-full py-3 border border-[#2A2A2A] rounded-xl font-logo text-xs">
          {pumpRef ? "✓ Pump photo attached" : "+ Pump or dipstick photo"}
        </button>
        <VoiceInput value={note} onChange={setNote} placeholder="Note (optional)…" rows={2} />
      </FormSection>

      <button type="button" onClick={submit} disabled={busy || !litres || !hourMeter} className="w-full bg-[#F5C518] text-black py-4 rounded-xl font-logo font-bold disabled:opacity-40">
        {busy ? "SAVING…" : "SAVE DIESEL LOG"}
      </button>
    </Modal>
  );
}
