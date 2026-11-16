import { useEffect, useState } from "react";
import { MeterPhoto } from "./ui/MeterPhoto.jsx";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import { fmtDateShort, localDayKey } from "../lib/utils.js";
import { bucketTonnes, previewFloor, productionForShift } from "../lib/dispatchMetrics.js";
import { tonnesPerBucket } from "../lib/siteConfig.js";
import { weighbridgePhotoRefs } from "../lib/dispatchPhotos.js";
import { resolveMediaUrl } from "../lib/media.js";
import { ProductionReadout, ShiftDispatchFields } from "./ShiftDispatchFields.jsx";
import * as wf from "../services/workflows.js";

function textOf(value) {
  return value == null || value === "" ? "" : String(value);
}

/** Operator fixes hours and the day's tonnes after a supervisor sends the shift back. */
export function ShiftCorrectionPanel({ shift, machine, site, user, siteDispatch = [], factors = {}, onDone, onResubmitted }) {
  const production = productionForShift(shift, siteDispatch, factors) || {};
  const day = localDayKey(shift.started_at || shift.ended_at);
  const dayRow = (siteDispatch || []).find((row) => (!site?.id || row.site_id === site.id) && String(row.dispatch_date || "").slice(0, 10) === day) || null;
  const [startHour, setStartHour] = useState(String(shift.start_hour_meter ?? ""));
  const [endHour, setEndHour] = useState(String(shift.end_hour_meter ?? ""));
  const [endPhotoRef, setEndPhotoRef] = useState(null);
  const [endPhotoPreview, setEndPhotoPreview] = useState(null);
  const [endPhotoError, setEndPhotoError] = useState(false);
  const [operatorNote, setOperatorNote] = useState("");
  const [excavatorBuckets, setExcavatorBuckets] = useState(textOf(production.excavator_buckets ?? shift.excavator_buckets));
  const [felBuckets, setFelBuckets] = useState(textOf(production.fel_buckets ?? shift.fel_buckets));
  const [tonnes, setTonnes] = useState(textOf(production.tonnes_dispatched ?? shift.tonnes_dispatched));
  const [trucks, setTrucks] = useState(textOf(production.trucks_dispatched ?? shift.trucks_dispatched));
  const [photos, setPhotos] = useState(() => weighbridgePhotoRefs(dayRow || shift).map((ref) => ({ ref, preview: null })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const excavatorEach = factors.excavator_bucket_tonnes ?? tonnesPerBucket(dayRow?.excavator_bucket_tonnes);
  const felEach = factors.fel_bucket_tonnes ?? tonnesPerBucket(dayRow?.fel_bucket_tonnes);
  const screened = bucketTonnes(excavatorBuckets, excavatorEach);
  const felTonnes = bucketTonnes(felBuckets, felEach);
  const dispatchedNow = tonnes === "" || !Number.isFinite(Number(tonnes)) ? null : Number(tonnes);
  const floorPreview = previewFloor(siteDispatch, site?.id, day, felTonnes, dispatchedNow, factors);

  const ticketRefs = weighbridgePhotoRefs(dayRow || shift).join("|");
  useEffect(() => {
    let cancelled = false;
    const refs = ticketRefs ? ticketRefs.split("|") : [];
    if (!refs.length) return undefined;
    Promise.all(refs.map(async (ref) => ({
      ref,
      preview: (await resolveMediaUrl(ref)) || null,
    }))).then((loaded) => {
      if (!cancelled) setPhotos(loaded);
    });
    return () => { cancelled = true; };
  }, [ticketRefs]);

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
        startHour,
        endHour,
        photoRef: endPhotoRef,
        operatorNote: operatorNote.trim(),
        dispatch: {
          excavatorBuckets,
          felBuckets,
          tonnes,
          trucks,
          photoRefs: photos.map((p) => p.ref).filter(Boolean),
        },
        factors,
      });
      await onDone?.();
      onResubmitted?.(updated);
    } catch (e) {
      setError(e.message || "Could not send back to supervisor");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#141414] border-2 border-[#F97316] rounded-2xl p-5 sm:p-6">
      <div className="text-center mb-4">
        <p className="font-logo text-2xl text-[#F97316] tracking-wider mb-1">Fix Your Shift Report</p>
        <p className="text-base text-[#F2F0EA]/70">
          Supervisor sent this back. Fix the problem and send it back for sign-off.
        </p>
      </div>

      <div className="bg-[#F97316]/10 border border-[#F97316]/40 rounded-xl p-4 mb-4">
        <p className="font-logo text-sm text-[#F97316] mb-2">Supervisor note:</p>
        <p className="text-base text-[#F2F0EA] leading-relaxed whitespace-pre-wrap">
          {shift.supervisor_comment || "Please check your meter reading and shift details."}
        </p>
      </div>

      <div className="space-y-2 mb-4 text-base text-[#F2F0EA]/80">
        <p><span className="text-[#F2F0EA]/50">Date:</span> {fmtDateShort(shift.started_at)}</p>
        <p><span className="text-[#F2F0EA]/50">Machine:</span> {machine?.name || "—"}</p>
        <p><span className="text-[#F2F0EA]/50">Meter now on report:</span> {shift.start_hour_meter}h → {shift.end_hour_meter}h</p>
        <p><span className="text-[#F2F0EA]/50">Machine hours on report:</span> {Number(shift.hours_worked || 0).toFixed(1)}h</p>
      </div>

      <label className="block font-logo text-sm text-[#F2F0EA] mb-2">Correct opening meter</label>
      <input
        value={startHour}
        onChange={(e) => setStartHour(e.target.value)}
        inputMode="decimal"
        className="w-full mb-4 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-3 text-[#F2F0EA]"
      />

      <label className="block font-logo text-sm text-[#F2F0EA] mb-2">Correct closing meter reading</label>
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

      <div className="mt-4 space-y-3">
        <p className="font-logo text-sm text-[#F2F0EA]">Buckets, trucks and tonnes</p>
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

      <label className="block font-logo text-sm text-[#F2F0EA] mb-2 mt-4">What did you fix? (optional)</label>
      <VoiceInput
        value={operatorNote}
        onChange={setOperatorNote}
        placeholder="Explain what you changed…"
        rows={3}
      />

      {error && <p className="text-[#EF4444] text-base mt-3">{error}</p>}

      <button
        type="button"
        onClick={handleResubmit}
        disabled={busy || !startHour || !endHour || !endPhotoRef}
        className="w-full mt-4 bg-[#F97316] text-black py-4 rounded-xl font-logo font-bold text-base disabled:opacity-40"
      >
        {busy ? "SENDING…" : "SEND BACK TO SUPERVISOR"}
      </button>

      <p className="text-sm text-[#F2F0EA]/45 text-center mt-3">
        Fix the hours, buckets, trucks and tonnes, then send it back. You can still clock in for the next shift.
      </p>
    </div>
  );
}
