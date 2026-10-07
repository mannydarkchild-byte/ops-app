import { useMemo } from "react";
import { buildActivityFeed } from "../lib/activityFeed.js";

function shortTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

/** Read-only feed — rows are not tappable (detail stays in the line). */
export function ActivityFeed({ events, fuelLogs, issues, machines, siteId, limit = 40 }) {
  const items = useMemo(
    () => buildActivityFeed({ events, fuelLogs, issues, machines, siteId }, { limit }),
    [events, fuelLogs, issues, machines, siteId, limit]
  );

  if (!items.length) {
    return <p className="text-sm text-ops-muted text-center py-6">No activity yet today.</p>;
  }

  return (
    <div>
      <p className="font-ui text-xs text-ops-muted mb-2">View only — open Problems or Reports for details</p>
      <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-ops-border/60 bg-ops-elevated/40 px-3">
        {items.map((item) => {
          const summary = [item.label, item.operator, item.detail].filter(Boolean).join(" · ");
          return (
            <div
              key={item.id}
              className="flex items-baseline gap-3 py-2.5 border-b border-ops-border/50 last:border-0 pointer-events-none"
            >
              <span className="font-ui text-xs text-ops-muted w-12 shrink-0">{shortTime(item.at)}</span>
              <p className="font-ui text-sm text-ops-text/90 min-w-0 truncate">{summary}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
