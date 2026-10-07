import { useMemo, useState } from "react";
import { localDayKey } from "../lib/utils.js";
import { Modal } from "./ui/Modal.jsx";
import { ShiftDispatchFields } from "./ShiftDispatchFields.jsx";

function dayLabel(day) {
  const date = new Date(`${String(day).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

function tonnesText(n) {
  if (n == null || n === "") return "—";
  return `${Number(n).toLocaleString("en-US")} t`;
}

export function SiteDispatchCard({ records = [], siteId, onSave }) {
  const today = localDayKey();
  const siteRows = useMemo(
    () => (records || [])
      .filter((row) => !siteId || row.site_id === siteId)
      .sort((a, b) => String(b.dispatch_date).localeCompare(String(a.dispatch_date))),
    [records, siteId]
  );
  const todayRow = siteRows.find((row) => String(row.dispatch_date).slice(0, 10) === today) || null;

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [tonnes, setTonnes] = useState("");
  const [trucks, setTrucks] = useState("");
  const [floorTonnes, setFloorTonnes] = useState("");
  const [photoRef, setPhotoRef] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadDay = (day) => {
    const row = siteRows.find((item) => String(item.dispatch_date).slice(0, 10) === day) || null;
    setDate(day);
    setTonnes(row?.tonnes_dispatched != null ? String(row.tonnes_dispatched) : "");
    setTrucks(row?.trucks_dispatched != null ? String(row.trucks_dispatched) : "");
    setFloorTonnes(row?.tonnes_on_floor != null ? String(row.tonnes_on_floor) : "");
    setPhotoRef(row?.weighbridge_photo_ref || row?.weighbridge_photo || null);
    setPhotoPreview(null);
    setError("");
  };

  const openEditor = () => {
    loadDay(today);
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await onSave({ date, tonnes, trucks, floorTonnes, photoRef });
      setOpen(false);
    } catch (e) {
      setError(e.message || "Could not save dispatch");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-[#2A2A2A] bg-[#141414] rounded-2xl p-4">
      <p className="font-logo text-[10px] tracking-wider text-[#F5C518]">DISPATCH</p>
      <p className="font-body text-sm text-[#F2F0EA]/70 mt-1">
        One weighbridge entry for the site today. Sign-off does not ask for this again.
      </p>
      {todayRow ? (
        <p className="font-logo text-lg text-[#F2F0EA] mt-3">
          {tonnesText(todayRow.tonnes_dispatched)} · {todayRow.trucks_dispatched ?? "—"} trucks
          {todayRow.tonnes_on_floor != null ? ` · ${tonnesText(todayRow.tonnes_on_floor)} on the floor` : ""}
        </p>
      ) : (
        <p className="font-body text-sm text-[#F2F0EA]/50 mt-3">Nothing entered for today.</p>
      )}
      {siteRows.length > 0 && (
        <div className="mt-3 space-y-1">
          {siteRows.slice(0, 5).map((row) => (
            <p key={row.id} className="text-[11px] text-[#F2F0EA]/45">
              {dayLabel(row.dispatch_date)} · {tonnesText(row.tonnes_dispatched)} · {row.trucks_dispatched ?? "—"} trucks
            </p>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={openEditor}
        className="w-full mt-4 py-3 rounded-full bg-[#F5C518] text-black font-logo font-bold"
      >
        {todayRow ? "Update today’s dispatch" : "Enter today’s dispatch"}
      </button>

      {open && (
        <Modal title="Site dispatch" color="yellow" onClose={() => setOpen(false)}>
          <label className="block mb-3">
            <span className="font-logo text-[10px] text-[#F2F0EA]/50 tracking-wider">DAY</span>
            <input
              type="date"
              value={date}
              onChange={(e) => loadDay(e.target.value)}
              className="mt-1 w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-full text-[#F2F0EA]"
            />
          </label>
          <ShiftDispatchFields
            tonnes={tonnes}
            trucks={trucks}
            floorTonnes={floorTonnes}
            photoPreview={photoPreview}
            onTonnes={setTonnes}
            onTrucks={setTrucks}
            onFloor={setFloorTonnes}
            onPhoto={(ref, data) => { setPhotoRef(ref); setPhotoPreview(data || null); }}
          />
          {error && <p className="text-sm text-[#EF4444] mb-3">{error}</p>}
          <button
            type="button"
            onClick={save}
            disabled={busy || !photoRef || tonnes === "" || trucks === ""}
            className="w-full bg-[#F5C518] text-black py-4 rounded-full font-logo font-bold disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save dispatch"}
          </button>
        </Modal>
      )}
    </div>
  );
}
