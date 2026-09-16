const EVENT_META = {
  CLOCK_IN: { icon: "⏱", label: "Clocked in" },
  CLOCK_OUT: { icon: "⏱", label: "Clocked out" },
  MACHINE_STARTED: { icon: "▶", label: "Machine started" },
  STOP: { icon: "⏹", label: "Machine stopped" },
  MACHINE_ENDED: { icon: "📋", label: "Day submitted" },
  METER_END_CAPTURED: { icon: "📸", label: "Closing meter photo" },
};

export function buildActivityFeed({ events, fuelLogs, issues, machines, siteId }, { limit = 40 } = {}) {
  const machineName = (id) => {
    if (!id) return "Site-wide";
    return machines.find((m) => m.id === id)?.name || id;
  };
  const items = [];

  for (const e of events.filter((x) => x.site_id === siteId)) {
    const meta = EVENT_META[e.type] || { icon: "•", label: e.type?.replace(/_/g, " ") || "Activity" };
    items.push({
      id: `ev-${e.id}`,
      at: e.timestamp || e.stopped_at || e.created_at,
      icon: meta.icon,
      label: meta.label,
      operator: e.operator_name,
      machine: machineName(e.machine_id),
      detail: e.type === "STOP" || e.type === "CLOCK_OUT"
        ? [e.reason, e.note].filter(Boolean).join(" — ")
        : (e.note || e.reason || ""),
    });
  }

  for (const f of fuelLogs.filter((x) => x.site_id === siteId)) {
    items.push({
      id: `fuel-${f.id}`,
      at: f.timestamp || f.created_at,
      icon: "⛽",
      label: "Diesel logged",
      operator: f.operator_name,
      machine: machineName(f.machine_id),
      detail: `${Number(f.litres || 0).toFixed(1)} L · meter ${f.hour_meter}h · tank ${f.tank_level || "—"}`,
    });
  }

  for (const i of issues.filter((x) => x.site_id === siteId)) {
    items.push({
      id: `iss-${i.id}`,
      at: i.created_at,
      icon: "⚠",
      label: "Issue reported",
      operator: i.reporter_name,
      machine: machineName(i.machine_id),
      detail: `${i.area} · ${i.priority} — ${(i.description || "").slice(0, 120)}`,
    });
  }

  return items
    .filter((x) => x.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, limit);
}
