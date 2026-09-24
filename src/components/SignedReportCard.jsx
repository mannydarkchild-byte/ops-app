import { useState } from "react";
import { fmtDateShort } from "../lib/utils.js";

export function SignedReportCard({ shift, machineName, onViewReport, onDownloadReport, onShareReport }) {
  const [busy, setBusy] = useState(false);

  const openReport = async () => {
    setBusy(true);
    try {
      await onViewReport?.(shift);
    } finally {
      setBusy(false);
    }
  };

  const saveReport = async () => {
    setBusy(true);
    try {
      await onDownloadReport?.(shift);
    } finally {
      setBusy(false);
    }
  };

  const shareReport = async () => {
    setBusy(true);
    try {
      await onShareReport?.(shift);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-logo text-sm text-[#F2F0EA]">{shift.operator_name || "Operator"}</p>
          <p className="text-[10px] text-[#F2F0EA]/45 mt-0.5">
            {fmtDateShort(shift.started_at)} · {machineName || "Machine"}
          </p>
          <p className="text-[10px] text-[#F5C518]/90 mt-1">
            ✓ Signed by {shift.supervisor_signature_name || "Supervisor"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-logo text-lg text-[#22C55E]">{Number(shift.hours_worked || 0).toFixed(1)}h</p>
          <p className="text-[9px] text-[#F2F0EA]/40">billable</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-4 text-[10px] text-[#F2F0EA]/50">
        <span>Meter {shift.start_hour_meter}h → {shift.end_hour_meter}h</span>
        {(shift.runtime_minutes > 0 || shift.downtime_minutes > 0) && (
          <span>Runtime {Math.round(shift.runtime_minutes || 0)}m · Downtime {Math.round(shift.downtime_minutes || 0)}m</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={openReport}
          disabled={busy}
          className="bg-[#F5C518] text-black py-3 rounded-xl font-logo font-bold disabled:opacity-50"
        >
          {busy ? "OPENING…" : "Open report"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={saveReport}
            disabled={busy}
            className="border border-[#2A2A2A] text-[#F2F0EA] py-3 rounded-xl font-logo disabled:opacity-50"
          >
            Download
          </button>
          <button
            type="button"
            onClick={shareReport}
            disabled={busy || !onShareReport}
            className="bg-[#22C55E] text-black py-3 rounded-xl font-logo font-bold disabled:opacity-50"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
