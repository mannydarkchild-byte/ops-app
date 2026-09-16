import { useMemo, useState } from "react";
import { buildAdminActivityLog, formatActivityRow } from "../../lib/adminActivityLog.js";

const PERIODS = [
  { id: 7, label: "Last 7 days" },
  { id: 30, label: "Last 30 days" },
];

const TYPES = [
  { id: "all", label: "All" },
  { id: "clock", label: "Clock in/out" },
  { id: "shift", label: "Shifts" },
  { id: "fuel", label: "Diesel" },
  { id: "issue", label: "Problems" },
  { id: "inspection", label: "Inspections" },
  { id: "expense", label: "Expenses" },
];

export function AdminActivityPanel({
  events, workSessions, shifts, issues, fuelLogs, inspections, expenses, machines, sites,
}) {
  const [days, setDays] = useState(7);
  const [siteId, setSiteId] = useState("all");
  const [type, setType] = useState("all");

  const rows = useMemo(() => {
    const items = buildAdminActivityLog({
      events, workSessions, shifts, issues, fuelLogs, inspections, expenses, machines, sites,
    }, { days, siteId, type });
    return items.map(formatActivityRow);
  }, [events, workSessions, shifts, issues, fuelLogs, inspections, expenses, machines, sites, days, siteId, type]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setDays(p.id)}
            className={`px-3 py-2 rounded-lg font-logo text-[10px] ${days === p.id ? "bg-[#F5C518] text-black" : "bg-[#141414] border border-[#2A2A2A] text-[#F2F0EA]/70"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl font-logo text-xs text-[#F2F0EA]"
        >
          <option value="all">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl font-logo text-xs text-[#F2F0EA]"
        >
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      <p className="text-[10px] text-[#F2F0EA]/40">{rows.length} event(s)</p>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-[#F2F0EA]/40">No activity in this period.</p>
        ) : rows.map((row) => (
          <div key={row.id} className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-3">
            <div className="flex justify-between gap-2 items-start">
              <p className="font-logo text-xs">
                {row.icon} {row.label}
              </p>
              <span className="text-[9px] text-[#F2F0EA]/40 shrink-0">{row.when}</span>
            </div>
            <p className="text-[10px] text-[#F2F0EA]/50 mt-1">
              {row.site} · {row.operator || "—"} · {row.machine}
            </p>
            {row.detail && (
              <p className="text-xs text-[#F2F0EA]/70 mt-1">{row.detail}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
