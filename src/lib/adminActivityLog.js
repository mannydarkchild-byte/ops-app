import { ISSUE, SHIFT } from "./constants.js";
import { fmtDate } from "./utils.js";

const TYPE_FILTERS = {
  all: () => true,
  clock: (x) => x.kind === "clock",
  shift: (x) => x.kind === "shift",
  fuel: (x) => x.kind === "fuel",
  issue: (x) => x.kind === "issue",
  inspection: (x) => x.kind === "inspection",
  expense: (x) => x.kind === "expense",
};

export function buildAdminActivityLog({
  events = [],
  workSessions = [],
  shifts = [],
  issues = [],
  fuelLogs = [],
  inspections = [],
  expenses = [],
  machines = [],
  sites = [],
}, {
  days = 7,
  siteId = "all",
  type = "all",
} = {}) {
  const cutoff = Date.now() - days * 86400000;
  const inWindow = (iso) => iso && new Date(iso).getTime() >= cutoff;
  const siteMatch = (rowSiteId) => siteId === "all" || rowSiteId === siteId;
  const machineName = (id) => {
    if (!id) return "Site-wide";
    return machines.find((m) => m.id === id)?.name || id;
  };
  const siteName = (id) => sites.find((s) => s.id === id)?.name || "—";

  const items = [];

  for (const ws of workSessions) {
    if (!siteMatch(ws.site_id) || !inWindow(ws.clock_in)) continue;
    items.push({
      id: `ws-in-${ws.id}`,
      at: ws.clock_in,
      kind: "clock",
      icon: "⏱",
      label: "Clocked in",
      site: siteName(ws.site_id),
      operator: ws.operator_name,
      machine: machineName(ws.machine_id),
      detail: "",
    });
    if (ws.clock_out && inWindow(ws.clock_out)) {
      items.push({
        id: `ws-out-${ws.id}`,
        at: ws.clock_out,
        kind: "clock",
        icon: "⏱",
        label: ws.status === "ended_early" ? "Early clock-out" : "Clocked out",
        site: siteName(ws.site_id),
        operator: ws.operator_name,
        machine: machineName(ws.machine_id),
        detail: ws.notes || "",
      });
    }
  }

  for (const e of events) {
    if (!siteMatch(e.site_id) || !inWindow(e.timestamp || e.stopped_at || e.created_at)) continue;
    const at = e.timestamp || e.stopped_at || e.created_at;
    const kind = e.type === "STOP" || e.type === "MACHINE_STARTED" || e.type === "MACHINE_ENDED" ? "shift" : "clock";
    items.push({
      id: `ev-${e.id}`,
      at,
      kind,
      icon: e.type === "STOP" ? "⏹" : e.type === "MACHINE_STARTED" ? "▶" : "•",
      label: (e.type || "Event").replace(/_/g, " "),
      site: siteName(e.site_id),
      operator: e.operator_name,
      machine: machineName(e.machine_id),
      detail: [e.reason, e.note].filter(Boolean).join(" — "),
    });
  }

  for (const s of shifts) {
    const at = s.verified_at || s.ended_at;
    if (!siteMatch(s.site_id) || !at || !inWindow(at)) continue;
    if (s.shift_status !== SHIFT.VERIFIED) continue;
    items.push({
      id: `sh-${s.id}`,
      at,
      kind: "shift",
      icon: "✅",
      label: "Shift verified",
      site: siteName(s.site_id),
      operator: s.operator_name,
      machine: machineName(s.machine_id),
      detail: `${Number(s.hours_worked || 0).toFixed(1)}h billable`,
    });
  }

  for (const f of fuelLogs) {
    if (!siteMatch(f.site_id) || !inWindow(f.timestamp || f.created_at)) continue;
    items.push({
      id: `fuel-${f.id}`,
      at: f.timestamp || f.created_at,
      kind: "fuel",
      icon: "⛽",
      label: "Diesel logged",
      site: siteName(f.site_id),
      operator: f.operator_name,
      machine: machineName(f.machine_id),
      detail: `${Number(f.litres || 0).toFixed(1)} L · meter ${f.hour_meter}h`,
    });
  }

  for (const i of issues) {
    if (!siteMatch(i.site_id) || !inWindow(i.created_at)) continue;
    items.push({
      id: `iss-${i.id}`,
      at: i.created_at,
      kind: "issue",
      icon: "⚠",
      label: i.status === ISSUE.RESOLVED ? "Issue resolved" : "Issue reported",
      site: siteName(i.site_id),
      operator: i.reporter_name,
      machine: machineName(i.machine_id),
      detail: `${i.area} · ${i.priority} — ${(i.description || "").slice(0, 100)}`,
    });
  }

  const inspectionBatches = new Map();
  for (const ins of inspections) {
    if (!siteMatch(ins.site_id) || !inWindow(ins.timestamp || ins.created_at)) continue;
    const key = ins.inspection_id || ins.id;
    if (!inspectionBatches.has(key)) {
      inspectionBatches.set(key, ins);
    }
  }
  for (const ins of inspectionBatches.values()) {
    items.push({
      id: `ins-${ins.inspection_id || ins.id}`,
      at: ins.timestamp || ins.created_at,
      kind: "inspection",
      icon: "📋",
      label: ins.type || "Inspection",
      site: siteName(ins.site_id),
      operator: ins.operator_name,
      machine: machineName(ins.machine_id),
      detail: ins.category || "",
    });
  }

  for (const ex of expenses) {
    if (!siteMatch(ex.site_id) || !inWindow(ex.date || ex.created_at)) continue;
    items.push({
      id: `exp-${ex.id}`,
      at: ex.date || ex.created_at,
      kind: "expense",
      icon: "💰",
      label: "Expense logged",
      site: siteName(ex.site_id),
      operator: ex.operator_name,
      machine: machineName(ex.machine_id),
      detail: `${ex.category} · R${Number(ex.amount || 0).toFixed(2)}`,
    });
  }

  const filterFn = TYPE_FILTERS[type] || TYPE_FILTERS.all;
  return items
    .filter((x) => x.at && filterFn(x))
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}

export function formatActivityRow(row) {
  return {
    ...row,
    when: fmtDate(row.at),
  };
}
