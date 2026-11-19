import { useEffect, useState } from "react";
import { listShiftStops } from "../services/workflows.js";
import { STOP_CATEGORIES } from "../lib/stopReasons.js";
import { formatDurationMinutes } from "../lib/shiftMetrics.js";

const REASONS = Object.values(STOP_CATEGORIES);

/** Closed list of stops on one shift. Open a row to change the reason or the hours. */
export function ShiftStopsEditor({ shiftId, onChange }) {
  const [stops, setStops] = useState([]);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listShiftStops(shiftId).then((rows) => {
      if (cancelled) return;
      setStops(rows);
      onChange?.(rows);
    });
    return () => { cancelled = true; };
  }, [shiftId]);

  const patch = (id, partial) => {
    setStops((current) => {
      const next = current.map((stop) => (stop.id === id ? { ...stop, ...partial } : stop));
      onChange?.(next);
      return next;
    });
  };

  if (!stops.length) {
    return <p className="font-body text-sm text-[#F2F0EA]/50">No stops were recorded on this shift.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="font-ui text-sm font-semibold text-[#F5C518]">Stops</p>
      <p className="font-body text-sm text-[#F2F0EA]/60">Open a stop to correct the reason or how long it lasted.</p>
      {stops.map((stop) => {
        const open = openId === stop.id;
        const hours = Number(stop.hours);
        const label = Number.isFinite(hours) ? formatDurationMinutes(Math.round(hours * 60)) : "—";
        return (
          <div key={stop.id} className="border border-[#2A2A2A] rounded-xl overflow-hidden">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : stop.id)}
              className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left"
            >
              <span className="font-ui text-sm text-[#F2F0EA]">{stop.reason || "Stop"}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="font-body text-sm text-[#F2F0EA]/60">{label}</span>
                <span className={`text-[#F5C518] transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>›</span>
              </span>
            </button>
            {open && (
              <div className="px-3 pb-3 space-y-3 border-t border-[#2A2A2A]">
                <label className="block">
                  <span className="ops-field-label">Reason</span>
                  <select
                    value={REASONS.includes(stop.reason) ? stop.reason : ""}
                    onChange={(event) => patch(stop.id, { reason: event.target.value })}
                    className="w-full mt-1 bg-[#141414] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]"
                  >
                    {!REASONS.includes(stop.reason) && <option value="">Choose a reason</option>}
                    {REASONS.map((reason) => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="ops-field-label">What happened</span>
                  <input
                    value={stop.note}
                    onChange={(event) => patch(stop.id, { note: event.target.value })}
                    className="w-full mt-1 bg-[#141414] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]"
                  />
                </label>
                <label className="block">
                  <span className="ops-field-label">Hours stopped</span>
                  <input
                    value={stop.hours}
                    inputMode="decimal"
                    onChange={(event) => patch(stop.id, { hours: event.target.value })}
                    className="w-full mt-1 bg-[#141414] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]"
                  />
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
