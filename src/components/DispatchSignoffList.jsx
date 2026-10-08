import { dispatchStatus, DISPATCH_STATUS, tonnesLabel } from "../lib/dispatchMetrics.js";

export function DispatchSignoffList({ rows = [], busyId, onSign, onReturn, onPreview }) {
  const waiting = rows.filter((row) => dispatchStatus(row) === DISPATCH_STATUS.WAITING);
  if (!waiting.length) return null;
  return (
    <div className="space-y-3">
      <p className="font-logo text-[10px] tracking-wider text-[#F5C518]">DISPATCH REPORTS</p>
      {waiting.map((row) => (
        <div key={row.id} className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-2">
          <p className="font-logo text-[#F2F0EA]">{String(row.dispatch_date).slice(0, 10)}</p>
          <p className="font-body text-sm text-[#F2F0EA]/70">
            {tonnesLabel(row.tonnes_dispatched)} · {row.trucks_dispatched ?? "—"} trucks
          </p>
          <p className="font-body text-xs text-[#F2F0EA]/50">
            Screened {tonnesLabel(row.tonnes_screened)} · floor {tonnesLabel(row.tonnes_on_floor)} · {row.recorded_by_name || "Dispatch"}
          </p>
          <button type="button" onClick={() => onPreview(row)} className="w-full py-3 rounded-xl border border-[#2A2A2A] text-[#F5C518] font-logo text-sm">
            Open report
          </button>
          <button type="button" disabled={busyId === row.id} onClick={() => onSign(row)} className="w-full py-3 rounded-xl bg-[#22C55E] text-black font-logo font-bold disabled:opacity-40">
            {busyId === row.id ? "Signing…" : "Sign off"}
          </button>
          <button type="button" disabled={busyId === row.id} onClick={() => onReturn(row)} className="w-full py-3 rounded-xl bg-[#F5C518] text-black font-logo disabled:opacity-40">
            Send back
          </button>
        </div>
      ))}
    </div>
  );
}
