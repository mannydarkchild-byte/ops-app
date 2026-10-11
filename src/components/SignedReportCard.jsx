import { useState } from "react";
import { fmtDateShort } from "../lib/utils.js";
import { agreementLabel } from "../lib/shiftAgreement.js";
import { formatDurationMinutes, shiftBillableHours } from "../lib/shiftMetrics.js";

export function SignedReportCard({ shift, machineName, events, siteSettings, onViewReport }) {
  const [busy, setBusy] = useState(false);

  const openReport = async () => {
    setBusy(true);
    try {
      await onViewReport?.(shift);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-ui text-sm font-semibold text-[#F2F0EA]">{machineName || "Machine"}</p>
          <p className="text-[10px] text-[#F2F0EA]/45 mt-0.5">
            {fmtDateShort(shift.started_at)} · {shift.operator_name || "Operator"}
          </p>
          <p className="text-[10px] text-[#F5C518]/90 mt-1">
            ✓ Signed by {shift.machine_signature_name || shift.supervisor_signature_name || "Supervisor"}
            {shift.site_signature_name ? ` + ${shift.site_signature_name} (site)` : ""}
          </p>
          <p className="text-[9px] text-[#F2F0EA]/40 mt-0.5">{agreementLabel(shift)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-ui text-lg font-semibold text-[#22C55E]">{shiftBillableHours(shift, events, siteSettings).toFixed(1)}h</p>
          <p className="text-[9px] text-[#F2F0EA]/40">billable</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-4 text-[10px] text-[#F2F0EA]/50">
        <span>Machine hours {Number(shift.hours_worked || 0).toFixed(1)}h · Meter {shift.start_hour_meter}h → {shift.end_hour_meter}h</span>
        {shift.tonnes_dispatched != null && (
          <span>
            {Number(shift.tonnes_dispatched).toLocaleString("en-US")} t · {shift.trucks_dispatched ?? "—"} trucks
            {shift.tonnes_on_floor != null ? ` · ${Number(shift.tonnes_on_floor).toLocaleString("en-US")} t on the floor` : ""}
          </span>
        )}
        {(shift.runtime_minutes > 0 || shift.downtime_minutes > 0) && (
          <span>Runtime {formatDurationMinutes(shift.runtime_minutes || 0)} · Downtime {formatDurationMinutes(shift.downtime_minutes || 0)}</span>
        )}
      </div>

      <button
        type="button"
        onClick={openReport}
        disabled={busy}
        className="w-full bg-[#F5C518] text-black py-3 rounded-xl font-ui font-semibold disabled:opacity-50"
      >
        {busy ? "Opening…" : "Open report"}
      </button>
    </div>
  );
}
