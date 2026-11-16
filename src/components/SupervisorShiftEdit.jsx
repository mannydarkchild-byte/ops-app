import { useEffect, useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { Button } from "./ui/Button.jsx";
import { MeterPhoto } from "./ui/MeterPhoto.jsx";
import { VoiceInput } from "./ui/VoiceInput.jsx";
import { localDayKey } from "../lib/utils.js";
import { bucketTonnes, previewFloor, productionForShift } from "../lib/dispatchMetrics.js";
import { tonnesPerBucket } from "../lib/siteConfig.js";
import { weighbridgePhotoRefs } from "../lib/dispatchPhotos.js";
import { resolveMediaUrl } from "../lib/media.js";
import { ProductionReadout, ShiftDispatchFields } from "./ShiftDispatchFields.jsx";
import { editShiftBeforeSign } from "../services/workflows.js";

function textOf(value) {
  return value == null || value === "" ? "" : String(value);
}

/** Supervisor corrects hours and the day's tonnes directly, including after sign-off. */
export function SupervisorShiftEdit({ shift, user, site, siteDispatch = [], factors = {}, onClose, onDone }) {
  const day = localDayKey(shift.started_at || shift.ended_at);
  const dayRow = (siteDispatch || []).find((row) => (!site?.id || row.site_id === site.id) && String(row.dispatch_date || "").slice(0, 10) === day) || null;
  const production = productionForShift(shift, siteDispatch, factors) || {};
  const [startHour, setStartHour] = useState(String(shift.start_hour_meter ?? ""));
  const [endHour, setEndHour] = useState(String(shift.end_hour_meter ?? ""));
  const [openingRef, setOpeningRef] = useState(null);
  const [openingPreview, setOpeningPreview] = useState(null);
  const [closingRef, setClosingRef] = useState(null);
  const [closingPreview, setClosingPreview] = useState(null);
  const [note, setNote] = useState("");
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
        dispatch: {
          excavatorBuckets,
          felBuckets,
          tonnes,
          trucks,
          photoRefs: photos.map((photo) => photo.ref).filter(Boolean),
        },
        site,
        factors,
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
        Correct the hours, buckets, trucks and tonnes here. A signed report stays signed.
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
      <div className="mt-4 space-y-3">
        <p className="font-ui text-sm font-semibold text-[#F5C518]">Buckets, trucks and tonnes</p>
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
      <p className="font-ui text-sm font-semibold text-ops-text mb-2 mt-4">What did you change?</p>
      <VoiceInput
        value={note}
        onChange={setNote}
        placeholder="Optional note on this edit…"
        rows={2}
      />
      {error && <p className="font-body text-sm text-[#EF4444] mt-3">{error}</p>}
      <Button className="w-full mt-4" size="lg" disabled={busy || startHour === ""} onClick={save}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </Modal>
  );
}
