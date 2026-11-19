import { useState } from "react";
import { SHIFT } from "../lib/constants.js";
import { getShiftStatus, localDayKey } from "../lib/utils.js";
import { bucketTonnes, previewFloor, productionForShift } from "../lib/dispatchMetrics.js";
import { tonnesPerBucket } from "../lib/siteConfig.js";
import { weighbridgePhotoRefs } from "../lib/dispatchPhotos.js";
import { resolveMediaUrl } from "../lib/media.js";
import { deleteOwnShift, replaceShiftMeterPhoto, saveShiftStops, submitOwnOpenShift, updateOwnShift } from "../services/workflows.js";
import { ShiftStopsEditor } from "./ShiftStopsEditor.jsx";
import { MeterPhoto } from "./ui/MeterPhoto.jsx";
import { SupervisorPicker } from "./SupervisorPicker.jsx";
import { Button } from "./ui/Button.jsx";
import { ProductionReadout, ShiftDispatchFields } from "./ShiftDispatchFields.jsx";

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

function textOf(value) {
  return value == null || value === "" ? "" : String(value);
}

async function photosFromRow(row) {
  const refs = weighbridgePhotoRefs(row);
  return Promise.all(refs.map(async (ref) => ({
    ref,
    preview: (await resolveMediaUrl(ref)) || null,
  })));
}

/** Edit or remove an operator's own shift, including after it is signed. */
export function OperatorShiftTools({ shift, user, supervisors = [], site, siteDispatch = [], factors = {}, onDone }) {
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
  const [excavatorBuckets, setExcavatorBuckets] = useState("");
  const [felBuckets, setFelBuckets] = useState("");
  const [tonnes, setTonnes] = useState("");
  const [trucks, setTrucks] = useState("");
  const [photos, setPhotos] = useState([]);
  const [stops, setStops] = useState([]);

  if (!shift) return null;

  const status = getShiftStatus(shift);
  const isOpenShift = status === SHIFT.RUNNING;
  const signed = status === SHIFT.VERIFIED || status === SHIFT.MACHINE_SIGNED;
  const day = localDayKey(shift.started_at || shift.ended_at);
  const dayRow = (siteDispatch || []).find((row) => (!site?.id || row.site_id === site.id) && String(row.dispatch_date || "").slice(0, 10) === day) || null;
  const excavatorEach = factors.excavator_bucket_tonnes ?? tonnesPerBucket(dayRow?.excavator_bucket_tonnes);
  const felEach = factors.fel_bucket_tonnes ?? tonnesPerBucket(dayRow?.fel_bucket_tonnes);
  const screened = bucketTonnes(excavatorBuckets, excavatorEach);
  const felTonnes = bucketTonnes(felBuckets, felEach);
  const dispatchedNow = tonnes === "" || !Number.isFinite(Number(tonnes)) ? null : Number(tonnes);
  const floorPreview = previewFloor(siteDispatch, site?.id, day, felTonnes, dispatchedNow, factors);

  const openEditor = () => {
    const production = productionForShift(shift, siteDispatch, factors) || {};
    setStartMeter(String(shift.start_hour_meter ?? ""));
    setEndMeter(shift.end_hour_meter == null ? "" : String(shift.end_hour_meter));
    setStartedAt(toLocalInput(shift.started_at));
    setEndedAt(toLocalInput(shift.ended_at));
    setNotes(shift.notes || "");
    setSupervisorId(shift.assigned_supervisor_id || "");
    setExcavatorBuckets(textOf(production.excavator_buckets ?? shift.excavator_buckets));
    setFelBuckets(textOf(production.fel_buckets ?? shift.fel_buckets));
    setTonnes(textOf(production.tonnes_dispatched ?? shift.tonnes_dispatched));
    setTrucks(textOf(production.trucks_dispatched ?? shift.trucks_dispatched));
    setPhotos(weighbridgePhotoRefs(dayRow || shift).map((ref) => ({ ref, preview: null })));
    photosFromRow(dayRow || shift).then(setPhotos);
    setPhotoSide("");
    setPhotoRef(null);
    setPhotoPreview(null);
    setError("");
    setOpen(true);
  };

  const save = async () => {
    setBusy("save");
    setError("");
    try {
      const supervisor = supervisors.find((s) => s.id === supervisorId) || null;
      const hasFigures = [excavatorBuckets, felBuckets, tonnes, trucks].some((value) => String(value).trim() !== "")
        || photos.some((photo) => photo.ref);
      const dispatch = (hasFigures || dayRow) ? {
        excavatorBuckets,
        felBuckets,
        tonnes,
        trucks,
        photoRefs: photos.map((p) => p.ref).filter(Boolean),
      } : null;
      let updated = isOpenShift
        ? await submitOwnOpenShift(user, shift, {
            startHour: startMeter,
            endHour: endMeter,
            startedAt: fromLocalInput(startedAt) || shift.started_at,
            endedAt: endedAt ? fromLocalInput(endedAt) : new Date().toISOString(),
            notes,
            assignedSupervisor: supervisor,
            dispatch,
            site,
            factors,
          })
        : await updateOwnShift(user, shift, {
            start_hour_meter: startMeter,
            end_hour_meter: endMeter,
            started_at: fromLocalInput(startedAt) || shift.started_at,
            ended_at: endedAt ? fromLocalInput(endedAt) : shift.ended_at,
            notes,
            assigned_supervisor_id: supervisor?.id || shift.assigned_supervisor_id || null,
            assigned_supervisor_name: supervisor?.name || shift.assigned_supervisor_name || null,
            dispatch,
          }, { site, factors });
      if (photoRef && photoSide) {
        updated = await replaceShiftMeterPhoto(user, updated, {
          side: photoSide,
          photoRef,
          reading: photoSide === "opening" ? startMeter : endMeter,
        });
      }
      if (stops.length) updated = await saveShiftStops(user, updated, stops);
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
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={isOpenShift ? "primary" : "secondary"}
            size="lg"
            className="flex-1"
            onClick={openEditor}
          >
            {isOpenShift ? "Finish leftover" : signed ? "Edit report" : "Edit shift"}
          </Button>
          {!signed && (
            <Button
              type="button"
              variant="danger"
              size="lg"
              onClick={remove}
              disabled={!!busy}
            >
              {busy === "delete" ? "Removing…" : "Delete"}
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-4 text-left">
          <p className="font-ui font-semibold text-[#F5C518] mb-1">
            {isOpenShift ? "Finish this leftover shift" : signed ? "Correct this signed report" : "Edit this shift"}
          </p>
          <p className="font-body text-sm text-[#F2F0EA]/60 mb-3">
            Hours, stops, buckets, trucks and tonnes can all be changed. Saving a signed report keeps the signature and updates the numbers.
          </p>
          <label className="block mb-3">
            <span className="ops-field-label">Opening meter</span>
            <input value={startMeter} onChange={(e) => setStartMeter(e.target.value)} inputMode="decimal" className="w-full mt-1 bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-3 text-[#F2F0EA]" />
          </label>
          <label className="block mb-3">
            <span className="ops-field-label">Closing meter</span>
            <input value={endMeter} onChange={(e) => setEndMeter(e.target.value)} inputMode="decimal" className="w-full mt-1 bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-3 text-[#F2F0EA]" />
          </label>
          <label className="block mb-3">
            <span className="ops-field-label">Started</span>
            <input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} className="w-full mt-1 bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-3 text-[#F2F0EA]" />
          </label>
          <label className="block mb-3">
            <span className="ops-field-label">Ended</span>
            <input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} className="w-full mt-1 bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-3 text-[#F2F0EA]" />
          </label>
          <div className="mb-3">
            <ShiftStopsEditor shiftId={shift.id} onChange={setStops} />
          </div>
          <label className="block mb-3">
            <span className="ops-field-label">Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full mt-1 bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-3 text-[#F2F0EA]" />
          </label>
          <div className="mb-3 space-y-3">
            <p className="font-ui text-sm font-semibold text-[#F5C518]">Buckets, trucks and tonnes</p>
            <p className="font-body text-sm text-[#F2F0EA]/60">These are the site figures for this day.</p>
            <ProductionReadout
              screened={screened}
              floor={floorPreview.closing}
              excavatorBuckets={excavatorBuckets}
              felBuckets={felBuckets}
              excavatorEach={excavatorEach}
              felEach={felEach}
              floorNote={`${floorPreview.opening.toLocaleString("en-US")} t opened${floorPreview.added == null ? "" : ` + ${floorPreview.added.toLocaleString("en-US")} t FEL`}${floorPreview.removed == null ? "" : ` − ${floorPreview.removed.toLocaleString("en-US")} t dispatched`}`}
            />
            <ShiftDispatchFields
              excavatorBuckets={excavatorBuckets}
              felBuckets={felBuckets}
              tonnes={tonnes}
              trucks={trucks}
              photos={photos}
              excavatorEach={excavatorEach}
              felEach={felEach}
              onExcavator={setExcavatorBuckets}
              onFel={setFelBuckets}
              onTonnes={setTonnes}
              onTrucks={setTrucks}
              onPhotos={setPhotos}
            />
          </div>
          {supervisors.length > 0 && (
            <div className="mb-3">
              <SupervisorPicker supervisors={supervisors} value={supervisorId} onChange={setSupervisorId} />
            </div>
          )}
          <div className="mb-3">
            {!photoSide ? (
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="w-full"
                onClick={() => setPhotoSide("closing")}
              >
                Replace a blurry meter photo
              </Button>
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
          <Button type="button" variant="primary" size="lg" className="w-full min-h-14 text-lg" disabled={!!busy} onClick={save}>
            {busy === "save" ? "Saving…" : isOpenShift ? "Send for sign-off" : "Save changes"}
          </Button>
          <Button type="button" variant="secondary" size="lg" className="w-full mt-2" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      )}
      {!open && error && <p className="font-body text-[#EF4444]">{error}</p>}
    </div>
  );
}
