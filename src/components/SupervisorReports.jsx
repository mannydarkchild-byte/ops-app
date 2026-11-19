import { useState } from "react";
import { MachineSelect } from "./DashboardKpi.jsx";
import { FieldSelect } from "./ui/FieldSelect.jsx";
import { dispatchInPeriod, dispatchStatus, DISPATCH_STATUS, productionForShift, screenedTonnes, tonnesLabel } from "../lib/dispatchMetrics.js";
import { whenMs } from "../lib/utils.js";

function fileDate(iso) {
  const date = new Date(whenMs(iso));
  if (Number.isNaN(date.getTime())) return "Undated";
  return date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

export function SupervisorReports({
  group = "operators",
  machines,
  machineId,
  onMachine,
  period,
  periodLabel,
  filter,
  filters,
  onFilter,
  signedReports = [],
  dispatches,
  siteConfig,
  onView,
  onEdit,
  onOpenDispatch,
}) {
  const dispatchRows = (dispatches || []).filter((row) => dispatchStatus(row) === DISPATCH_STATUS.SIGNED && dispatchInPeriod(row, period));
  const filedShifts = machineId
    ? signedReports.filter((row) => row.machine_id === machineId)
    : signedReports;

  const dispatchDays = [];
  for (const row of [...dispatchRows].sort((a, b) => String(b.dispatch_date || "").localeCompare(String(a.dispatch_date || "")))) {
    const key = String(row.dispatch_date || "").slice(0, 10) || "undated";
    const last = dispatchDays[dispatchDays.length - 1];
    if (last?.key === key) last.rows.push(row);
    else dispatchDays.push({ key, label: fileDate(row.dispatch_date), rows: [row] });
  }

  return (
    <div className="space-y-4">
      {filters?.length > 0 && (
        <FieldSelect value={filter} onChange={onFilter}>
          {filters.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </FieldSelect>
      )}

      {group === "operators" && (
        <section className="space-y-3">
          {machines?.length > 0 && onMachine && (
            <MachineSelect allowAll machines={machines} value={machineId} onChange={onMachine} />
          )}
          <SignedReportDays
            reports={filedShifts}
            machines={machines}
            dispatches={dispatches}
            siteConfig={siteConfig}
            periodLabel={periodLabel}
            onView={onView}
            onEdit={onEdit}
          />
        </section>
      )}

      {group === "dispatch" && (
        <DispatchDays days={dispatchDays} periodLabel={periodLabel} siteConfig={siteConfig} onOpenDispatch={onOpenDispatch} />
      )}
    </div>
  );
}

function SignedReportDays({ reports, machines, dispatches, siteConfig, periodLabel, onView, onEdit }) {
  const [openDay, setOpenDay] = useState(null);
  const machineName = (id) => machines?.find((machine) => machine.id === id)?.name || "Machine";
  if (!reports.length) {
    return <p className="font-body text-sm text-ops-muted">No signed operator reports for {periodLabel}.</p>;
  }
  const map = new Map();
  const sorted = [...reports].sort(
    (a, b) => whenMs(b.verified_at || b.ended_at || b.started_at) - whenMs(a.verified_at || a.ended_at || a.started_at)
  );
  for (const row of sorted) {
    const iso = row.verified_at || row.ended_at || row.started_at;
    const date = new Date(whenMs(iso));
    const key = Number.isNaN(date.getTime())
      ? "undated"
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, { key, label: fileDate(iso), rows: [] });
    map.get(key).rows.push(row);
  }
  const days = [...map.values()];
  return (
    <div className="space-y-2">
      {days.map((day) => {
        const open = openDay === day.key;
        const count = day.rows.length;
        return (
          <section key={day.key} className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenDay(open ? null : day.key)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="font-ui font-semibold text-[#F5C518]">{day.label}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="font-body text-sm text-ops-muted">{count} {count === 1 ? "entry" : "entries"}</span>
                <span className={`text-[#F5C518] text-lg transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>›</span>
              </span>
            </button>
            {open && day.rows.map((row) => {
              const production = productionForShift(row, dispatches, siteConfig);
              const screened = production?.tonnes_screened;
              const hours = Number(row.hours_worked || 0).toFixed(1);
              return (
                <div key={row.id} className="px-4 py-3 border-t border-[#2A2A2A]">
                  <button type="button" onClick={() => onView?.(row)} className="w-full text-left">
                    <p className="font-ui font-semibold text-ops-text">{row.operator_name || "Operator"}</p>
                    <p className="font-body text-xs text-ops-muted mt-1">
                      {machineName(row.machine_id)} · {hours}h
                      {screened == null ? "" : ` · ${tonnesLabel(screened)} screened`}
                    </p>
                  </button>
                  {onEdit && (
                    <button type="button" onClick={() => onEdit(row)} className="font-ui text-sm text-[#F5C518] mt-2">
                      Edit times and stops
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function DispatchDays({ days, periodLabel, siteConfig, onOpenDispatch }) {
  const [openDay, setOpenDay] = useState(null);
  if (!days.length) {
    return <p className="font-body text-sm text-ops-muted">No signed dispatch day for {periodLabel}.</p>;
  }
  return (
    <section className="space-y-2">
      {days.map((day) => {
        const open = openDay === day.key;
        const count = day.rows.length;
        return (
          <div key={day.key} className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenDay(open ? null : day.key)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="font-ui font-semibold text-[#F5C518]">{day.label}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="font-body text-sm text-ops-muted">{count} {count === 1 ? "entry" : "entries"}</span>
                <span className={`text-[#F5C518] text-lg transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>›</span>
              </span>
            </button>
            {open && day.rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onOpenDispatch?.(row)}
                className="w-full text-left px-4 py-3 border-t border-[#2A2A2A]"
              >
                <p className="font-ui font-semibold text-ops-text">{tonnesLabel(screenedTonnes(row, siteConfig))} screened</p>
                <p className="font-body text-xs text-ops-muted mt-1">{tonnesLabel(row.tonnes_on_floor)} on the floor · {row.trucks_dispatched ?? "—"} trucks</p>
              </button>
            ))}
          </div>
        );
      })}
    </section>
  );
}
