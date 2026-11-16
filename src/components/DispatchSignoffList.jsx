import { Button } from "./ui/Button.jsx";
import { dispatchStatus, DISPATCH_STATUS, screenedTonnes, tonnesLabel } from "../lib/dispatchMetrics.js";

export function DispatchSignoffList({ rows = [], busyId, onSign, onReturn, onPreview, emptyHint }) {
  const waiting = rows.filter((row) => dispatchStatus(row) === DISPATCH_STATUS.WAITING);
  if (!waiting.length) {
    return emptyHint ? <p className="font-body text-sm text-ops-muted">{emptyHint}</p> : null;
  }
  return (
    <div className="space-y-3">
      {waiting.map((row) => (
        <div key={row.id} className="bg-ops-card border-2 border-ops-gold rounded-2xl p-4 space-y-2">
          <p className="font-ui font-semibold text-ops-text">{String(row.dispatch_date).slice(0, 10)}</p>
          <p className="font-ui text-2xl font-semibold text-[#22C55E] mt-1">{tonnesLabel(screenedTonnes(row))}</p>
          <p className="font-body text-xs text-ops-muted">
            Material screened{row.excavator_buckets == null ? "" : ` · ${row.excavator_buckets} excavator buckets`}
          </p>
          <p className="font-ui text-2xl font-semibold text-[#F97316]">{tonnesLabel(row.tonnes_on_floor)}</p>
          <p className="font-body text-xs text-ops-muted">
            On the floor{row.fel_buckets == null ? "" : ` · ${row.fel_buckets} FEL buckets`}
          </p>
          <p className="font-body text-sm text-ops-muted">
            {tonnesLabel(row.tonnes_dispatched)} dispatched · {row.trucks_dispatched ?? "—"} trucks · {row.recorded_by_name || "Dispatch"}
          </p>
          <Button className="w-full" variant="secondary" onClick={() => onPreview(row)}>
            Open report
          </Button>
          <Button className="w-full" disabled={busyId === row.id} onClick={() => onSign(row)}>
            {busyId === row.id ? "Signing…" : "Sign this day"}
          </Button>
          <Button className="w-full" variant="secondary" disabled={busyId === row.id} onClick={() => onReturn(row)}>
            Send back
          </Button>
        </div>
      ))}
    </div>
  );
}
