import { useEffect, useMemo, useState } from "react";
import { localDayKey } from "../lib/utils.js";
import { bucketTonnes, previewFloor } from "../lib/dispatchMetrics.js";
import { tonnesPerBucket } from "../lib/siteConfig.js";
import { weighbridgePhotoRefs } from "../lib/dispatchPhotos.js";
import { resolveMediaUrl } from "../lib/media.js";
import { ProductionReadout, ShiftDispatchFields } from "./ShiftDispatchFields.jsx";

function todayRow(records, siteId) {
  const day = localDayKey();
  return (records || []).find((row) => (!siteId || row.site_id === siteId) && String(row.dispatch_date).slice(0, 10) === day) || null;
}

async function photosFromRow(row) {
  const refs = weighbridgePhotoRefs(row);
  return Promise.all(refs.map(async (ref) => ({
    ref,
    preview: (await resolveMediaUrl(ref)) || null,
  })));
}

export function OperatorTonnageBlock({ records = [], siteId, factors = {}, onSnapshot }) {
  const day = localDayKey();
  const row = useMemo(() => todayRow(records, siteId), [records, siteId]);

  const [excavatorBuckets, setExcavatorBuckets] = useState(row?.excavator_buckets != null ? String(row.excavator_buckets) : "");
  const [felBuckets, setFelBuckets] = useState(row?.fel_buckets != null ? String(row.fel_buckets) : "");
  const [tonnes, setTonnes] = useState(row?.tonnes_dispatched != null ? String(row.tonnes_dispatched) : "");
  const [trucks, setTrucks] = useState(row?.trucks_dispatched != null ? String(row.trucks_dispatched) : "");
  const [photos, setPhotos] = useState(() => weighbridgePhotoRefs(row).map((ref) => ({ ref, preview: null })));

  useEffect(() => {
    setExcavatorBuckets(row?.excavator_buckets != null ? String(row.excavator_buckets) : "");
    setFelBuckets(row?.fel_buckets != null ? String(row.fel_buckets) : "");
    setTonnes(row?.tonnes_dispatched != null ? String(row.tonnes_dispatched) : "");
    setTrucks(row?.trucks_dispatched != null ? String(row.trucks_dispatched) : "");
    setPhotos(weighbridgePhotoRefs(row).map((ref) => ({ ref, preview: null })));
    photosFromRow(row).then(setPhotos);
  }, [row?.id, row?.updated_at]);

  const excavatorEach = factors.excavator_bucket_tonnes ?? tonnesPerBucket(row?.excavator_bucket_tonnes);
  const felEach = factors.fel_bucket_tonnes ?? tonnesPerBucket(row?.fel_bucket_tonnes);
  const screened = bucketTonnes(excavatorBuckets, excavatorEach);
  const felTonnes = bucketTonnes(felBuckets, felEach);
  const dispatchedNow = tonnes === "" || tonnes == null || !Number.isFinite(Number(tonnes)) ? null : Number(tonnes);
  const floorPreview = previewFloor(records, siteId, day, felTonnes, dispatchedNow, factors);
  const floor = floorPreview.closing;
  const photoRefs = photos.map((p) => p.ref).filter(Boolean);
  const missing = [
    excavatorBuckets === "" && "excavator buckets",
    felBuckets === "" && "FEL buckets",
    tonnes === "" && "tonnes",
    trucks === "" && "trucks",
  ].filter(Boolean);
  const ready = missing.length === 0;

  const fields = {
    date: day,
    excavatorBuckets,
    felBuckets,
    tonnes,
    trucks,
    photoRefs,
  };

  useEffect(() => {
    onSnapshot?.({ fields, ready, missing, row, floor });
  }, [excavatorBuckets, felBuckets, tonnes, trucks, photoRefs.join("|"), ready, missing.join("|"), floor, row?.id]);

  return (
    <div className="space-y-3">
      <div>
        <p className="font-ui text-sm font-semibold text-[#F5C518]">Today’s tonnes</p>
        <p className="font-body text-sm text-ops-muted mt-1">
          Excavator buckets, FEL buckets, trucks and weighbridge tonnes. On the floor updates from those numbers.
        </p>
        {factors.excavator_bucket_tonnes && factors.fel_bucket_tonnes && (
          <p className="font-body text-xs text-[#F2F0EA]/45 mt-1">
            Excavator {factors.excavator_bucket_tonnes} t a bucket · FEL {factors.fel_bucket_tonnes} t a bucket.
          </p>
        )}
      </div>

      <ProductionReadout
        screened={screened}
        floor={floor}
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
  );
}
