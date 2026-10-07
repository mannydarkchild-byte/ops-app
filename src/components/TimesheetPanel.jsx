import { useMemo } from "react";
import { summarizeTimesheet } from "../lib/timesheet.js";
import { Chip } from "./ui/Chip.jsx";
import { Button } from "./ui/Button.jsx";

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
    <div className="bg-ops-card border border-ops-border rounded-xl p-4">
      <h3 className="font-ui text-xl font-semibold text-ops-gold mb-1">Timesheet</h3>
      <p className="font-body text-ops-muted mb-3">
        Hours from clock-in to clock-out{periodLabel ? ` · ${periodLabel}` : ""}. Rows below are view only.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <Chip key={f.id} selected={filter === f.id} onClick={() => onFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="ops-stat">
          <p className="font-ui text-sm text-ops-muted">On site</p>
          <p className="font-ui text-3xl font-bold text-ops-gold mt-1">{summary.hours.toFixed(1)}h</p>
        </div>
        <div className="ops-stat">
          <p className="font-ui text-sm text-ops-muted">Left early</p>
          <p className="font-ui text-3xl font-bold text-ops-orange mt-1">{summary.leftEarly}</p>
        </div>
      </div>

      <Button type="button" variant="primary" size="lg" className="w-full mb-4" onClick={onPreview}>
        Open timesheet
      </Button>

      {summary.byOperator.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {summary.byOperator.map((op) => (
            <div key={op.operator_id || op.operator_name} className="flex justify-between gap-3 text-sm pointer-events-none">
              <p className="font-body text-ops-text truncate">{op.operator_name}</p>
              <p className="font-ui font-semibold text-ops-gold shrink-0">{op.hours.toFixed(1)}h</p>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-ops-muted text-center py-4">No clock-in records for this period.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-ops-border/70 bg-ops-elevated/30 px-3 py-2.5 pointer-events-none"
            >
              <div className="flex justify-between gap-3">
                <p className="font-ui text-sm font-semibold text-ops-text truncate">{r.operator_name || "Operator"}</p>
                <p className="font-ui text-sm font-semibold text-ops-gold shrink-0">{r.hours.toFixed(1)}h</p>
              </div>
              <p className="font-body text-xs text-ops-muted mt-1">
                {r.dateLabel} · {r.inLabel} → {r.outLabel}
                {machineName(r.machine_id) ? ` · ${machineName(r.machine_id)}` : ""}
              </p>
              <p className={`font-ui text-xs mt-1 ${
                r.status === "ended_early" ? "text-ops-orange" : r.status === "active" ? "text-ops-green" : "text-ops-muted"
              }`}>
                {r.statusLabel}
              </p>
              {r.notes && (
                <p className="font-body text-xs text-ops-muted mt-1">{r.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
