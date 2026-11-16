import { stopReasonDetail } from "./stopReasons.js";

const EVENT_META = {
  CLOCK_IN: { icon: "⏱", label: "Clocked in" },
  CLOCK_OUT: { icon: "⏱", label: "Clocked out" },
  MACHINE_STARTED: { icon: "▶", label: "Machine started" },
  STOP: { icon: "⏹", label: "Machine stopped" },
  MACHINE_ENDED: { icon: "📋", label: "Day submitted" },
  SHIFT_RESUBMITTED: { icon: "↩", label: "Shift resubmitted" },
  METER_END_CAPTURED: { icon: "📸", label: "Closing meter photo" },
};

export function buildActivityFeed({ events, fuelLogs, issues, machines, siteId, machineId = null }, { limit = 40, fromMs = null, toMs = null } = {}) {
  const machineName = (id) => {
    if (!id) return "Site-wide";
    return machines.find((m) => m.id === id)?.name || id;
  };
  const items = [];

  const onSite = (row) => !siteId || row.site_id === siteId;
  const onMachine = (row) => !machineId || row.machine_id === machineId;
  const inWindow = (iso) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return false;
    if (fromMs != null && t < fromMs) return false;
    if (toMs != null && t > toMs) return false;
    return true;
  };

  for (const e of events.filter((x) => onSite(x) && onMachine(x))) {
    const meta = EVENT_META[e.type] || { icon: "•", label: e.type?.replace(/_/g, " ") || "Activity" };
    items.push({
      id: `ev-${e.id}`,
      kind: "event",
      sourceId: e.id,
      at: e.timestamp || e.stopped_at || e.created_at,
      icon: meta.icon,
      label: meta.label,
      operator: e.operator_name,
      machine: machineName(e.machine_id),
      detail: (() => {
        if (e.type === "STOP") {
          const shown = stopReasonDetail(e.reason, e.note);
          return [shown.category, shown.detail].filter(Boolean).join(" — ");
        }
        if (e.type === "CLOCK_OUT") return [e.reason, e.note].filter(Boolean).join(" — ");
        return e.note || e.reason || "";
      })(),
      source: e,
    });
  }

  for (const f of fuelLogs.filter((x) => onSite(x) && onMachine(x))) {
    items.push({
      id: `fuel-${f.id}`,
      kind: "fuel",
      sourceId: f.id,
      at: f.timestamp || f.created_at,
      icon: "⛽",
      label: "Diesel logged",
      operator: f.operator_name,
      machine: machineName(f.machine_id),
      detail: `${Number(f.litres || 0).toFixed(1)} L · meter ${f.hour_meter}h · tank ${f.tank_level || "—"}`,
      source: f,
    });
  }

  for (const i of issues.filter((x) => onSite(x) && onMachine(x))) {
    items.push({
      id: `iss-${i.id}`,
      kind: "issue",
      sourceId: i.id,
      at: i.created_at,
      icon: "⚠",
      label: "Issue reported",
      operator: i.reporter_name,
      machine: machineName(i.machine_id),
      detail: `${i.area} · ${i.priority} — ${(i.description || "").slice(0, 120)}`,
      source: i,
    });
  }

  return items
    .filter((x) => inWindow(x.at))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, limit);
}
