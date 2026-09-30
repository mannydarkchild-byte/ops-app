import { useMemo } from "react";
import { buildActivityFeed } from "../lib/activityFeed.js";

function shortTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

/** One line per event. Detail stays in the row, not a second paragraph. */
export function ActivityFeed({ events, fuelLogs, issues, machines, siteId, limit = 40 }) {
  const items = useMemo(
    () => buildActivityFeed({ events, fuelLogs, issues, machines, siteId }, { limit }),
    [events, fuelLogs, issues, machines, siteId, limit]
  );

  if (!items.length) {
    return <p className="text-sm text-ops-muted text-center py-6">No activity yet today.</p>;
  }

  return (
    <div className="max-h-[50vh] overflow-y-auto">
      {items.map((item) => {
        const summary = [item.label, item.operator, item.detail].filter(Boolean).join(" · ");
        return (
          <div key={item.id} className="flex items-baseline gap-3 py-2.5 border-b border-ops-border last:border-0">
            <span className="font-ui text-xs text-ops-muted w-12 shrink-0">{shortTime(item.at)}</span>
            <p className="font-ui text-sm text-ops-text min-w-0 truncate">{summary}</p>
          </div>
        );
      })}
    </div>
  );
}
