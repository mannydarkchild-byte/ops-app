import { Button } from "./ui/Button.jsx";
import { dispatchStatus, DISPATCH_STATUS, tonnesLabel } from "../lib/dispatchMetrics.js";

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
          <p className="font-body text-sm text-ops-muted">
            {tonnesLabel(row.tonnes_dispatched)} · {row.trucks_dispatched ?? "—"} trucks
          </p>
          <p className="font-body text-xs text-ops-muted">
            Screened {tonnesLabel(row.tonnes_screened)} · floor {tonnesLabel(row.tonnes_on_floor)} · {row.recorded_by_name || "Dispatch"}
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
