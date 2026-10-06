import { useState } from "react";
import { SHIFT } from "../lib/constants.js";
import { getShiftStatus } from "../lib/utils.js";
import { deleteOwnShift, replaceShiftMeterPhoto, submitOwnOpenShift, updateOwnShift } from "../services/workflows.js";
import { MeterPhoto } from "./ui/MeterPhoto.jsx";
import { SupervisorPicker } from "./SupervisorPicker.jsx";

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** Edit or remove an operator's own unsigned shift. */
export function OperatorShiftTools({ shift, user, supervisors = [], onDone }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [startMeter, setStartMeter] = useState(String(shift.start_hour_meter ?? ""));
  const [endMeter, setEndMeter] = useState(shift.end_hour_meter == null ? "" : String(shift.end_hour_meter));
  const [startedAt, setStartedAt] = useState(toLocalInput(shift.started_at));
  const [endedAt, setEndedAt] = useState(toLocalInput(shift.ended_at));
  const [notes, setNotes] = useState(shift.notes || "");
  const [supervisorId, setSupervisorId] = useState(shift.assigned_supervisor_id || "");
  const [photoSide, setPhotoSide] = useState("");
  const [photoRef, setPhotoRef] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  if (!shift || getShiftStatus(shift) === SHIFT.VERIFIED) return null;

  const isOpenShift = getShiftStatus(shift) === SHIFT.RUNNING;

  const save = async () => {
    setBusy("save");
    setError("");
    try {
      const supervisor = supervisors.find((s) => s.id === supervisorId) || null;
      let updated = isOpenShift
        ? await submitOwnOpenShift(user, shift, {
            startHour: startMeter,
            endHour: endMeter,
            startedAt: fromLocalInput(startedAt) || shift.started_at,
            endedAt: endedAt ? fromLocalInput(endedAt) : new Date().toISOString(),
            notes,
            assignedSupervisor: supervisor,
          })
        : await updateOwnShift(user, shift, {
            start_hour_meter: startMeter,
            end_hour_meter: endMeter,
            started_at: fromLocalInput(startedAt) || shift.started_at,
            ended_at: endedAt ? fromLocalInput(endedAt) : shift.ended_at,
            notes,
            assigned_supervisor_id: supervisor?.id || shift.assigned_supervisor_id || null,
            assigned_supervisor_name: supervisor?.name || shift.assigned_supervisor_name || null,
          });
      if (photoRef && photoSide) {
        updated = await replaceShiftMeterPhoto(user, updated, {
          side: photoSide,
          photoRef,
          reading: photoSide === "opening" ? startMeter : endMeter,
        });
      }
      setOpen(false);
      setPhotoSide("");
      setPhotoRef(null);
      setPhotoPreview(null);
      onDone?.(updated);
    } catch (e) {
      setError(e.message || "Could not save");
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    if (!window.confirm("Remove this shift from your list? If it is still open, the machine will be free to start again.")) return;
    setBusy("delete");
    setError("");
    try {
      await deleteOwnShift(user, shift);
      onDone?.({ removed: true, id: shift.id });
    } catch (e) {
      setError(e.message || "Could not remove this shift");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="mt-3 space-y-2">
      {!open ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={isOpenShift
              ? "min-h-12 px-4 rounded-xl bg-[#F5C518] text-black font-ui text-sm font-semibold"
              : "py-2 font-ui text-sm text-[#F5C518] underline underline-offset-2"}
          >
            {isOpenShift ? "Finish leftover" : "Edit shift"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={!!busy}
            className="min-h-11 px-4 rounded-xl border border-[#EF4444]/40 text-[#EF4444] font-ui text-sm font-semibold disabled:opacity-40"
          >
            {busy === "delete" ? "Removing…" : "Delete"}
          </button>
        </div>
      ) : (
        <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-4 text-left">
          <p className="font-logo text-[#F5C518] mb-3">{isOpenShift ? "Finish this leftover shift" : "Edit this shift"}</p>
          <label className="block mb-3">
            <span className="font-logo text-xs text-[#F2F0EA]/70">Opening meter</span>
            <input value={startMeter} onChange={(e) => setStartMeter(e.target.value)} inputMode="decimal" className="w-full mt-1 bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-3 text-[#F2F0EA]" />
          </label>
          <label className="block mb-3">
            <span className="font-logo text-xs text-[#F2F0EA]/70">Closing meter</span>
            <input value={endMeter} onChange={(e) => setEndMeter(e.target.value)} inputMode="decimal" className="w-full mt-1 bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-3 text-[#F2F0EA]" />
          </label>
          <label className="block mb-3">
            <span className="font-logo text-xs text-[#F2F0EA]/70">Started</span>
            <input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} className="w-full mt-1 bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-3 text-[#F2F0EA]" />
          </label>
          <label className="block mb-3">
            <span className="font-logo text-xs text-[#F2F0EA]/70">Ended</span>
            <input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} className="w-full mt-1 bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-3 text-[#F2F0EA]" />
          </label>
          <label className="block mb-3">
            <span className="font-logo text-xs text-[#F2F0EA]/70">Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full mt-1 bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-3 text-[#F2F0EA]" />
          </label>
          {supervisors.length > 0 && (
            <div className="mb-3">
              <SupervisorPicker supervisors={supervisors} value={supervisorId} onChange={setSupervisorId} />
            </div>
          )}
          <div className="mb-3">
            {!photoSide ? (
              <button
                type="button"
                onClick={() => setPhotoSide("closing")}
                className="font-ui text-sm text-[#F5C518] underline underline-offset-2"
              >
                Replace a blurry meter photo
              </button>
            ) : (
              <>
                <p className="font-ui text-xs text-[#F2F0EA]/70 mb-2">Clearer meter photo</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => { setPhotoSide("opening"); setPhotoRef(null); setPhotoPreview(null); }}
                    className={`min-h-10 rounded-xl font-ui text-sm ${photoSide === "opening" ? "bg-[#F5C518] text-black" : "border border-[#2A2A2A] text-[#F2F0EA]"}`}
                  >
                    Opening
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPhotoSide("closing"); setPhotoRef(null); setPhotoPreview(null); }}
                    className={`min-h-10 rounded-xl font-ui text-sm ${photoSide === "closing" ? "bg-[#F5C518] text-black" : "border border-[#2A2A2A] text-[#F2F0EA]"}`}
                  >
                    Closing
                  </button>
                </div>
                <MeterPhoto
                  value={photoSide === "opening" ? startMeter : endMeter}
                  onValue={photoSide === "opening" ? setStartMeter : setEndMeter}
                  photo={photoPreview}
                  onPhoto={(ref, data) => { setPhotoRef(ref); setPhotoPreview(data); }}
                  hint="Take a clear photo. The reading above updates if you type a new one."
                  required={false}
                />
              </>
            )}
          </div>
          {isOpenShift && supervisors.length === 0 && (
            <p className="font-body text-[#EF4444] mb-2">No supervisor on this phone. Ask admin to add one before you send this.</p>
          )}
          {error && <p className="font-body text-[#EF4444] mb-2">{error}</p>}
          <button type="button" disabled={!!busy} onClick={save} className="w-full bg-[#F5C518] text-black py-4 rounded-xl font-logo font-bold disabled:opacity-40">
            {busy === "save" ? "Saving…" : isOpenShift ? "Send for sign-off" : "Save changes"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="w-full mt-2 border border-[#2A2A2A] text-[#F2F0EA]/70 py-3 rounded-xl font-logo">
            Cancel
          </button>
        </div>
      )}
      {!open && error && <p className="font-body text-[#EF4444]">{error}</p>}
    </div>
  );
}
