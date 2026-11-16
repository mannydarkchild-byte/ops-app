import { useMemo } from "react";
import { DashboardKpi } from "./DashboardKpi.jsx";
import { screenedTonnes, summarizeDispatch, tonnesLabel } from "../lib/dispatchMetrics.js";

export function DispatchKpis({ records, siteId, period, factors = {}, onOpen }) {
  const summary = useMemo(
    () => summarizeDispatch(records, siteId, period, factors),
    [records, siteId, period, factors]
  );
  const today = summary.todayLabel;
  const todayRow = summary.todayRow;
  const todayScreened = todayRow ? screenedTonnes(todayRow, factors) : null;

  return (
    <div className="space-y-2">
      <p className="font-ui text-xs font-semibold text-[#F5C518]">Dispatch - {period?.label || "This cycle"}</p>
      <p className="font-body text-xs text-[#F2F0EA]/50">Site totals from the dispatch report. Today: {today}. Floor is the latest closing stock: previous floor + FEL tonnes − dispatched tonnes.</p>
      <div className="grid grid-cols-2 gap-3">
        <DashboardKpi label="Weighbridge" value={tonnesLabel(summary.weighbridge)} sub="This cycle" color="#F5C518" onClick={() => onOpen(summary.details.weighbridge)} />
        <DashboardKpi label="Trucks" value={String(summary.trucks)} sub="This cycle" color="#F2F0EA" onClick={() => onOpen(summary.details.trucks)} />
        <DashboardKpi
          label="Material screened"
          value={tonnesLabel(todayScreened ?? summary.screened)}
          sub={[
            todayRow?.excavator_buckets != null ? `${todayRow.excavator_buckets} excavator buckets` : null,
            `${tonnesLabel(summary.screened)} this cycle`,
          ].filter(Boolean).join(" · ")}
          color="#22C55E"
          onClick={() => onOpen(summary.details.screened)}
        />
        <DashboardKpi
          label="On the floor"
          value={tonnesLabel(summary.floor)}
          sub={[
            todayRow?.fel_buckets != null ? `${todayRow.fel_buckets} FEL buckets` : null,
            summary.latest ? String(summary.latest.dispatch_date).slice(0, 10) : "No entry",
          ].filter(Boolean).join(" · ")}
          color="#F97316"
          onClick={() => onOpen(summary.details.floor)}
        />
      </div>
    </div>
  );
}
