import { useMemo } from "react";
import { DashboardKpi } from "./DashboardKpi.jsx";
import { summarizeDispatch, tonnesLabel } from "../lib/dispatchMetrics.js";

export function DispatchKpis({ records, siteId, period, factors = {}, onOpen }) {
  const summary = useMemo(
    () => summarizeDispatch(records, siteId, period, factors),
    [records, siteId, period, factors]
  );
  const today = summary.todayLabel;

  return (
    <div className="space-y-2">
      <p className="font-logo text-[10px] tracking-wider text-[#F5C518]">DISPATCH · {period?.label || "THIS CYCLE"}</p>
      <p className="font-body text-xs text-[#F2F0EA]/50">Site totals from the dispatch report. Today: {today}. Floor is the latest closing stock: previous floor + FEL tonnes − dispatched tonnes.</p>
      <div className="grid grid-cols-2 gap-3">
        <DashboardKpi label="Weighbridge" value={tonnesLabel(summary.weighbridge)} sub="This cycle" color="#F5C518" onClick={() => onOpen(summary.details.weighbridge)} />
        <DashboardKpi label="Trucks" value={String(summary.trucks)} sub="This cycle" color="#F2F0EA" onClick={() => onOpen(summary.details.trucks)} />
        <DashboardKpi label="Screened" value={tonnesLabel(summary.screened)} sub="Excavator buckets" color="#22C55E" onClick={() => onOpen(summary.details.screened)} />
        <DashboardKpi label="On the floor" value={tonnesLabel(summary.floor)} sub={summary.latest ? String(summary.latest.dispatch_date).slice(0, 10) : "No entry"} color="#F97316" onClick={() => onOpen(summary.details.floor)} />
      </div>
    </div>
  );
}
