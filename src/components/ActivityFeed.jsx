import { useMemo } from "react";
import { buildActivityFeed } from "../lib/activityFeed.js";
import { fmtDate } from "../lib/utils.js";

export function ActivityFeed({ events, fuelLogs, issues, machines, siteId, limit = 40 }) {
  const items = useMemo(
    () => buildActivityFeed({ events, fuelLogs, issues, machines, siteId }, { limit }),
    [events, fuelLogs, issues, machines, siteId, limit]
  );

  if (!items.length) {
    return <p className="text-sm text-[#F2F0EA]/40 text-center py-6">No operator activity yet today.</p>;
  }

  return (
    <div className="space-y-0 max-h-[50vh] overflow-y-auto">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3 py-3 border-b border-[#2A2A2A] last:border-0">
          <span className="text-lg shrink-0 w-6 text-center">{item.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5">
              <p className="font-logo text-xs text-[#F2F0EA]">{item.label}</p>
              <p className="text-[9px] text-[#F2F0EA]/35 shrink-0">{fmtDate(item.at)}</p>
            </div>
            <p className="text-[10px] text-[#F5C518]/80 mt-0.5">
              {item.operator || "—"}{item.machine ? ` · ${item.machine}` : ""}
            </p>
            {item.detail && (
              <p className="text-[10px] text-[#F2F0EA]/50 mt-1 line-clamp-2">{item.detail}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
