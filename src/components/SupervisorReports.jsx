import { SignedReportCard } from "./SignedReportCard.jsx";
import { DashboardKpi, MachineSelect } from "./DashboardKpi.jsx";
import { HOUR_LABELS } from "../lib/shiftMetrics.js";
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
  machines,
  machineId,
  onMachine,
  period,
  periodLabel,
  filter,
  filters,
  onFilter,
  signedReports,
  signedBillable,
  signedHours,
  signedDetails,
  onOpenDetail,
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
    <div className="space-y-5">
      <div>
        <p className="font-logo text-[10px] tracking-wider text-[#F5C518]">REPORTS</p>
        <p className="font-body text-sm text-[#F2F0EA]/70 mt-1">Signed shift reports and signed dispatch reports for {periodLabel}.</p>
      </div>

      {machines?.length > 0 && machineId && (
        <MachineSelect machines={machines} value={machineId} onChange={onMachine} />
      )}

      <div className="flex flex-wrap gap-1">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onFilter(item.id)}
            className={`ops-chip px-3 py-2 rounded-lg font-logo text-[10px] tracking-wider ${filter === item.id ? "bg-[#F5C518] text-black" : "bg-[#141414] border border-[#2A2A2A] text-[#F2F0EA]/70"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="space-y-3">
        <p className="font-logo text-sm text-[#F2F0EA]">Dispatch</p>
        {dispatchRows.length === 0 ? (
          <p className="font-body text-sm text-[#F2F0EA]/40">No signed dispatch report in this period.</p>
        ) : dispatchRows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onOpenDispatch(row)}
            className="w-full text-left bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4"
          >
            <p className="font-logo text-[#F2F0EA]">{String(row.dispatch_date).slice(0, 10)}</p>
            <p className="font-body text-sm text-[#F2F0EA]/70 mt-1">
              {tonnesLabel(row.tonnes_dispatched)} · {row.trucks_dispatched ?? "—"} trucks · signed by {row.signed_by_name || "supervisor"}
            </p>
          </button>
        ))}
      </section>

      <section className="space-y-3">
        <p className="font-logo text-sm text-[#F2F0EA]">Signed shifts</p>
        <div className="grid grid-cols-2 gap-3">
          <DashboardKpi label="Signed reports" value={String(signedReports.length)} sub={periodLabel} color="#F2F0EA" />
          <DashboardKpi label={HOUR_LABELS.billable} value={`${signedBillable.toFixed(1)}h`} sub="Signed shifts" color="#22C55E" onClick={() => onOpenDetail(signedDetails.billable)} />
          <DashboardKpi label={HOUR_LABELS.machine} value={`${signedHours.toFixed(1)}h`} sub="Closing meter" color="#22C55E" onClick={() => onOpenDetail(signedDetails.machine)} />
        </div>
        {shiftGroups.length === 0 ? (
          <p className="font-body text-sm text-[#F2F0EA]/40">No signed shift reports in this period.</p>
        ) : shiftGroups.map((group) => (
          <div key={group.label} className="space-y-2">
            <p className="font-logo text-[10px] tracking-wider text-[#F2F0EA]/45">{group.label}</p>
            {group.rows.map((row) => (
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
    </div>
  );
}
