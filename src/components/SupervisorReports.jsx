import { SignedReportCard } from "./SignedReportCard.jsx";
import { MachineSelect } from "./DashboardKpi.jsx";
import { FieldSelect } from "./ui/FieldSelect.jsx";
import { dispatchInPeriod, dispatchStatus, DISPATCH_STATUS, tonnesLabel } from "../lib/dispatchMetrics.js";

function dayLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Undated";
  return date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

function groupByDay(rows, isoOf) {
  const groups = [];
  for (const row of rows) {
    const label = dayLabel(isoOf(row));
    const last = groups[groups.length - 1];
    if (last?.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }
  return groups;
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
  machineName,
  events,
  siteConfig,
  onView,
  onDownload,
  onShare,
  onOpenDispatch,
}) {
  const shiftGroups = groupByDay(signedReports, (row) => row.verified_at || row.ended_at || row.started_at);
  const dispatchRows = (dispatches || []).filter((row) => dispatchStatus(row) === DISPATCH_STATUS.SIGNED && dispatchInPeriod(row, period));

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
          {machines?.length > 0 && machineId && (
            <MachineSelect machines={machines} value={machineId} onChange={onMachine} />
          )}
          {shiftGroups.length === 0 ? (
            <p className="font-body text-sm text-ops-muted">No signed operator reports for {periodLabel}.</p>
          ) : shiftGroups.map((day) => (
            <div key={day.label} className="space-y-2">
              <p className="font-ui text-xs font-semibold text-ops-muted">{day.label}</p>
              {day.rows.map((row) => (
                <SignedReportCard
                  key={row.id}
                  shift={row}
                  machineName={machineName(row.machine_id)}
                  events={events}
                  siteSettings={siteConfig}
                  onViewReport={onView}
                  onDownloadReport={onDownload}
                  onShareReport={onShare}
                />
              ))}
            </div>
          ))}
        </section>
      )}

      {group === "dispatch" && (
        <section className="space-y-3">
          {dispatchRows.length === 0 ? (
            <p className="font-body text-sm text-ops-muted">No signed dispatch day for {periodLabel}.</p>
          ) : dispatchRows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onOpenDispatch(row)}
              className="w-full text-left bg-ops-card border-2 border-ops-gold rounded-2xl p-4"
            >
              <p className="font-ui font-semibold text-ops-text">{String(row.dispatch_date).slice(0, 10)}</p>
              <p className="font-body text-sm text-ops-muted mt-1">
                {tonnesLabel(row.tonnes_dispatched)} · {row.trucks_dispatched ?? "—"} trucks · signed by {row.signed_by_name || "supervisor"}
              </p>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
