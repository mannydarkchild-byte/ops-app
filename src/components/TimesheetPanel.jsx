import { useMemo } from "react";
import { summarizeTimesheet } from "../lib/timesheet.js";

const FILTERS = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "cycle", label: "This cycle" },
  { id: "month", label: "This month" },
  { id: "all", label: "All" },
];

export function TimesheetPanel({
  rows,
  periodLabel,
  filter,
  onFilter,
  onPreview,
  machines = [],
}) {
  const summary = useMemo(() => summarizeTimesheet(rows), [rows]);
  const machineName = (id) => machines.find((m) => m.id === id)?.name;

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">
      <h3 className="font-logo text-[#F5C518] text-sm mb-1">TIMESHEET</h3>
      <p className="font-body text-xs text-[#F2F0EA]/55 mb-3">
        Hours from clock-in to clock-out{periodLabel ? ` · ${periodLabel}` : ""}.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilter(f.id)}
            className={`px-3 py-2 rounded-lg font-logo text-[10px] ${
              filter === f.id ? "bg-[#F5C518] text-black" : "bg-[#0A0A0A] border border-[#2A2A2A]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-[#0A0A0A] rounded-lg p-3 text-center border border-[#2A2A2A]">
          <p className="font-logo text-[9px] text-[#F2F0EA]/45 tracking-wider">ON SITE</p>
          <p className="font-logo text-lg text-[#F5C518] mt-0.5">{summary.hours.toFixed(1)}h</p>
        </div>
        <div className="bg-[#0A0A0A] rounded-lg p-3 text-center border border-[#2A2A2A]">
          <p className="font-logo text-[9px] text-[#F2F0EA]/45 tracking-wider">SESSIONS</p>
          <p className="font-logo text-lg text-[#F2F0EA] mt-0.5">{summary.sessions}</p>
        </div>
        <div className="bg-[#0A0A0A] rounded-lg p-3 text-center border border-[#2A2A2A]">
          <p className="font-logo text-[9px] text-[#F2F0EA]/45 tracking-wider">LEFT EARLY</p>
          <p className="font-logo text-lg text-[#F97316] mt-0.5">{summary.leftEarly}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onPreview}
        className="w-full bg-[#F5C518] text-black py-3.5 rounded-xl font-logo font-bold tracking-wider mb-4"
      >
        PREVIEW / PRINT TIMESHEET
      </button>

      {summary.byOperator.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {summary.byOperator.map((op) => (
            <div key={op.operator_id || op.operator_name} className="flex justify-between gap-3 text-sm">
              <p className="font-body text-[#F2F0EA] truncate">{op.operator_name}</p>
              <p className="font-logo text-[#F5C518] shrink-0">{op.hours.toFixed(1)}h</p>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-[#F2F0EA]/40 text-center py-4">No clock-in records for this period.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg p-3">
              <div className="flex justify-between gap-3">
                <p className="font-logo text-sm text-[#F2F0EA] truncate">{r.operator_name || "Operator"}</p>
                <p className="font-logo text-sm text-[#F5C518] shrink-0">{r.hours.toFixed(1)}h</p>
              </div>
              <p className="font-body text-xs text-[#F2F0EA]/55 mt-1">
                {r.dateLabel} · {r.inLabel} → {r.outLabel}
                {machineName(r.machine_id) ? ` · ${machineName(r.machine_id)}` : ""}
              </p>
              <p className={`font-logo text-[10px] mt-1 ${
                r.status === "ended_early" ? "text-[#F97316]" : r.status === "active" ? "text-[#22C55E]" : "text-[#F2F0EA]/50"
              }`}>
                {r.statusLabel}
              </p>
              {r.notes && (
                <p className="font-body text-xs text-[#F2F0EA]/45 mt-1">{r.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
