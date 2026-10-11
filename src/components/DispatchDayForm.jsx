import { useEffect, useMemo, useState } from "react";
import { localDayKey } from "../lib/utils.js";
import { bucketTonnes, DISPATCH_STATUS, dispatchStatus, previewFloor } from "../lib/dispatchMetrics.js";
import { ShiftDispatchFields } from "./ShiftDispatchFields.jsx";

function dayRow(records, siteId, day) {
  return (records || []).find((row) => (!siteId || row.site_id === siteId) && String(row.dispatch_date).slice(0, 10) === day) || null;
}

export function DispatchDayForm({
  records = [],
  siteId,
  factors = {},
  supervisors = [],
  suggestedSupervisorId = null,
  onSave,
  onSubmit,
  onPreview,
}) {
  const today = localDayKey();
  const [date, setDate] = useState(today);
  const row = useMemo(() => dayRow(records, siteId, date), [records, siteId, date]);
  const status = dispatchStatus(row);
  const locked = !!row && status !== DISPATCH_STATUS.DRAFT;

  const [excavatorBuckets, setExcavatorBuckets] = useState(row?.excavator_buckets != null ? String(row.excavator_buckets) : "");
  const [felBuckets, setFelBuckets] = useState(row?.fel_buckets != null ? String(row.fel_buckets) : "");
  const [tonnes, setTonnes] = useState(row?.tonnes_dispatched != null ? String(row.tonnes_dispatched) : "");
  const [trucks, setTrucks] = useState(row?.trucks_dispatched != null ? String(row.trucks_dispatched) : "");
  const [photoRef, setPhotoRef] = useState(row?.weighbridge_photo_ref || row?.weighbridge_photo || null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [supervisorId, setSupervisorId] = useState(row?.assigned_supervisor_id || suggestedSupervisorId || "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!row) return;
    setExcavatorBuckets((cur) => (cur === "" && row.excavator_buckets != null ? String(row.excavator_buckets) : cur));
    setFelBuckets((cur) => (cur === "" && row.fel_buckets != null ? String(row.fel_buckets) : cur));
    setTonnes((cur) => (cur === "" && row.tonnes_dispatched != null ? String(row.tonnes_dispatched) : cur));
    setTrucks((cur) => (cur === "" && row.trucks_dispatched != null ? String(row.trucks_dispatched) : cur));
    setPhotoRef((cur) => cur || row.weighbridge_photo_ref || row.weighbridge_photo || null);
    setSupervisorId((cur) => cur || row.assigned_supervisor_id || suggestedSupervisorId || "");
  }, [row, suggestedSupervisorId]);

  const loadDay = (day) => {
    const next = dayRow(records, siteId, day);
    setDate(day);
    setExcavatorBuckets(next?.excavator_buckets != null ? String(next.excavator_buckets) : "");
    setFelBuckets(next?.fel_buckets != null ? String(next.fel_buckets) : "");
    setTonnes(next?.tonnes_dispatched != null ? String(next.tonnes_dispatched) : "");
    setTrucks(next?.trucks_dispatched != null ? String(next.trucks_dispatched) : "");
    setPhotoRef(next?.weighbridge_photo_ref || next?.weighbridge_photo || null);
    setPhotoPreview(null);
    setSupervisorId(next?.assigned_supervisor_id || suggestedSupervisorId || "");
    setError("");
  };

  const fields = {
    date,
    excavatorBuckets,
    felBuckets,
    tonnes,
    trucks,
    photoRef,
  };
  const screened = bucketTonnes(excavatorBuckets, factors.excavator_bucket_tonnes);
  const felTonnes = bucketTonnes(felBuckets, factors.fel_bucket_tonnes);
  const dispatchedNow = tonnes === "" || tonnes == null || !Number.isFinite(Number(tonnes)) ? null : Number(tonnes);
  const floorPreview = previewFloor(records, siteId, date, felTonnes, dispatchedNow, factors);
  const floor = floorPreview.closing;

  const run = async (key, fn) => {
    setBusy(key);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message || "Could not save");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="font-logo text-[10px] tracking-wider text-[#F5C518]">TODAY</p>
        <p className="font-body text-sm text-[#F2F0EA]/70 mt-1">
          {factors.excavator_bucket_tonnes && factors.fel_bucket_tonnes
            ? `Excavator ${factors.excavator_bucket_tonnes} t a bucket · FEL ${factors.fel_bucket_tonnes} t a bucket.`
            : "Set tonnes per excavator bucket and tonnes per FEL bucket in Admin or Manager, under More → Bucket size."}
        </p>
      </div>

      <label className="block">
        <span className="font-logo text-[10px] text-[#F2F0EA]/50 tracking-wider">DAY</span>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => loadDay(e.target.value)}
          className="mt-1 w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]"
        />
      </label>

      {status === DISPATCH_STATUS.WAITING && (
        <p className="font-body text-sm text-[#F5C518]">Waiting for {row?.assigned_supervisor_name || "a supervisor"} to sign off.</p>
      )}
      {status === DISPATCH_STATUS.SIGNED && (
        <p className="font-body text-sm text-[#22C55E]">Signed by {row?.signed_by_name || "supervisor"}.</p>
      )}
      {row?.supervisor_comment && status === DISPATCH_STATUS.DRAFT && (
        <p className="font-body text-sm text-[#F97316]">Sent back: {row.supervisor_comment}</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-3">
          <p className="font-logo text-[10px] text-[#F2F0EA]/45">SCREENED</p>
          <p className="font-logo text-lg text-[#F2F0EA]">{screened == null ? "—" : `${screened.toLocaleString("en-US")} t`}</p>
        </div>
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-3">
          <p className="font-logo text-[10px] text-[#F2F0EA]/45">ON THE FLOOR</p>
          <p className="font-logo text-lg text-[#F2F0EA]">{floor == null ? "—" : `${floor.toLocaleString("en-US")} t`}</p>
          <p className="font-body text-[10px] text-[#F2F0EA]/45 mt-1">
            {`${floorPreview.opening.toLocaleString("en-US")} t opened`}
            {floorPreview.added == null ? "" : ` + ${floorPreview.added.toLocaleString("en-US")} FEL`}
            {floorPreview.removed == null ? "" : ` − ${floorPreview.removed.toLocaleString("en-US")} dispatched`}
          </p>
        </div>
      </div>

      {!locked && (
        <>
          <ShiftDispatchFields
            excavatorBuckets={excavatorBuckets}
            felBuckets={felBuckets}
            tonnes={tonnes}
            trucks={trucks}
            photoPreview={photoPreview}
            excavatorEach={factors.excavator_bucket_tonnes}
            felEach={factors.fel_bucket_tonnes}
            onExcavator={setExcavatorBuckets}
            onFel={setFelBuckets}
            onTonnes={setTonnes}
            onTrucks={setTrucks}
            onPhoto={(ref, data) => { setPhotoRef(ref); setPhotoPreview(data || null); }}
          />
          <label className="block">
            <span className="font-logo text-[10px] text-[#F2F0EA]/50 tracking-wider">SUPERVISOR</span>
            <select
              value={supervisorId}
              onChange={(e) => setSupervisorId(e.target.value)}
              className="mt-1 w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]"
            >
              <option value="">Who signs this off</option>
              {supervisors.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
          </label>
        </>
      )}

      {error && <p className="text-sm text-[#EF4444]">{error}</p>}

      <div className="grid grid-cols-1 gap-2">
        {!locked && (
          <>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run("save", () => onSave(fields))}
              className="w-full py-3 rounded-full border border-[#2A2A2A] text-[#F2F0EA] font-logo"
            >
              {busy === "save" ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              disabled={!!busy || !supervisorId}
              onClick={() => run("send", () => onSubmit(fields, supervisors.find((s) => s.id === supervisorId)))}
              className="w-full py-4 rounded-full bg-[#F5C518] text-black font-logo font-bold disabled:opacity-40"
            >
              {busy === "send" ? "Sending…" : "Send for sign-off"}
            </button>
          </>
        )}
        {row && (
          <button type="button" onClick={() => onPreview(row)} className="w-full py-3 rounded-full border border-[#F5C518]/50 text-[#F5C518] font-logo">
            Open daily report
          </button>
        )}
      </div>
    </div>
  );
}
