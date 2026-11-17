import { useMemo, useState } from "react";
import { summarizeTimesheet } from "../lib/timesheet.js";
import { localDayKey } from "../lib/utils.js";

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
      <h3 className="font-logo text-[#F5C518] text-2xl mb-1">Timesheet</h3>
      <p className="font-body text-[#F2F0EA]/70 mb-3">
        Hours from clock-in to clock-out{periodLabel ? ` · ${periodLabel}` : ""}.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilter(f.id)}
            className={`ops-chip px-3 py-2 rounded-lg font-logo text-[10px] ${
              filter === f.id ? "bg-[#F5C518] text-black" : "bg-[#0A0A0A] border border-[#2A2A2A]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#0A0A0A] rounded-xl p-4 text-center border border-[#2A2A2A]">
          <p className="font-logo text-[#F2F0EA]/55">On site</p>
          <p className="font-logo text-3xl text-[#F5C518] mt-1">{summary.hours.toFixed(1)}h</p>
          {summary.overtimeHours > 0 && (
            <p className="font-body text-xs text-[#F97316] mt-1">incl. {summary.overtimeHours.toFixed(1)}h overtime</p>
          )}
        </div>
        <div className="bg-[#0A0A0A] rounded-xl p-4 text-center border border-[#2A2A2A]">
          <p className="font-logo text-[#F2F0EA]/55">Left early</p>
          <p className="font-logo text-3xl text-[#F97316] mt-1">{summary.leftEarly}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onPreview}
        className="w-full bg-[#F5C518] text-black py-3.5 rounded-xl font-logo font-bold tracking-wider mb-4"
      >
        OPEN TIMESHEET
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

      <TimesheetDays rows={rows} machineName={machineName} />
    </div>
  );
}

function timesheetDayLabel(key) {
  if (!key || key === "undated") return "Undated";
  const today = localDayKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === today) return "Today";
  if (key === localDayKey(yesterday)) return "Yesterday";
  return new Date(`${key}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

function TimesheetDays({ rows, machineName }) {
  const [openDay, setOpenDay] = useState(null);
  const days = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const key = row.clock_in ? (localDayKey(row.clock_in) || "undated") : "undated";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
      .map(([key, dayRows]) => ({ key, label: timesheetDayLabel(key), rows: dayRows }));
  }, [rows]);

  if (!rows.length) {
    return <p className="text-sm text-[#F2F0EA]/40 text-center py-4">No clock-in records for this period.</p>;
  }

  return (
    <div className="space-y-2">
      {days.map((day) => {
        const open = openDay === day.key;
        const count = day.rows.length;
        return (
          <section key={day.key} className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl overflow-hidden">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenDay(open ? null : day.key)}
              className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left"
            >
              <span className="font-ui font-semibold text-[#F5C518]">{day.label}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="font-body text-sm text-[#F2F0EA]/55">{count} {count === 1 ? "entry" : "entries"}</span>
                <span className={`text-[#F5C518] transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>›</span>
              </span>
            </button>
            {open && day.rows.map((row) => (
              <div key={row.id} className="px-3 py-3 border-t border-[#2A2A2A]">
                <div className="flex justify-between gap-3">
                  <p className="font-logo text-sm text-[#F2F0EA] truncate">{row.operator_name || "Operator"}</p>
                  <p className="font-logo text-sm text-[#F5C518] shrink-0">
                    {row.hours.toFixed(1)}h{row.overtimeHours > 0 ? ` · ${row.overtimeHours.toFixed(1)} OT` : ""}
                  </p>
                </div>
                <p className="font-body text-xs text-[#F2F0EA]/55 mt-1">
                  {row.inLabel} → {row.outLabel}
                  {machineName(row.machine_id) ? ` · ${machineName(row.machine_id)}` : ""}
                </p>
                <p className={`font-logo text-[10px] mt-1 ${
                  row.status === "ended_early" ? "text-[#F97316]" : row.status === "active" ? "text-[#22C55E]" : "text-[#F2F0EA]/50"
                }`}>
                  {row.statusLabel}
                </p>
                {row.notes && (
                  <p className="font-body text-xs text-[#F2F0EA]/45 mt-1">{row.notes}</p>
                )}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
