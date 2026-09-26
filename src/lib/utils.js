import { ISSUE, PRESTART_INSPECTION_ITEMS, PRIMARY_MACHINE_CODE, ROLES, SHIFT } from "./constants.js";

export const nowISO = () => new Date().toISOString();
export const money = (n) => `R${Number(n || 0).toFixed(2)}`;
export const hoursBetween = (start) => start ? Math.max(0, (Date.now() - new Date(start).getTime()) / 3600000) : 0;
export const makeId = (prefix = "ID") => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
export const fmtDate = (d) => d ? new Date(d).toLocaleString("en-ZA") : "—";
export const fmtDateShort = (d) => d ? new Date(d).toLocaleDateString("en-ZA") : "—";

export function getBillingPeriod(ref = new Date(), cycleStartDay = 26) {
  const startDay = Math.min(28, Math.max(1, Number(cycleStartDay) || 26));
  const d = new Date(ref);
  const day = d.getDate();
  const start = new Date(d);
  if (day >= startDay) {
    start.setDate(startDay); start.setHours(0, 0, 0, 0);
  } else {
    start.setMonth(start.getMonth() - 1);
    start.setDate(startDay);
    start.setHours(0, 0, 0, 0);
  }
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(startDay);
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 59, 999);
  const lbl = `${start.toLocaleDateString("en-ZA", { day: "2-digit", month: "short" })} → ${end.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}`;
  return { start, end, label: lbl };
}

export function inPeriod(iso, period) {
  if (!iso || !period) return false;
  const t = new Date(iso).getTime();
  return t >= period.start.getTime() && t <= period.end.getTime();
}

function isSupervisorRole(role) {
  return String(role || "").toLowerCase() === ROLES.SUPERVISOR;
}

/** Supervisors the operator can pick — same site first, then any supervisor already on this phone. */
export function getSiteSupervisors(profiles, siteId) {
  const all = (profiles || []).filter((p) => isSupervisorRole(p.role) && p.active !== false);
  if (!siteId) return all;
  const onSite = all.filter((p) => !p.site_id || p.site_id === siteId);
  return onSite.length ? onSite : all;
}

/** Suggest day (06–18) or night supervisor from shift_band on profile */
export function suggestSupervisor(supervisors, at = new Date()) {
  if (!supervisors?.length) return null;
  const hour = at.getHours();
  const band = hour >= 6 && hour < 18 ? "day" : "night";
  return (
    supervisors.find((s) => s.shift_band === band) ||
    supervisors.find((s) => s.shift_band === "any" || !s.shift_band) ||
    supervisors[0]
  );
}

/** Resolve shift status from current or legacy field */
export function getShiftStatus(shift) {
  return shift?.shift_status || shift?.status || null;
}

/** RUNNING shift that belongs to the operator's current clock-in session */
export function shiftBelongsToWorkSession(shift, workSession, userId) {
  if (!shift || !workSession || !userId) return false;
  const status = getShiftStatus(shift);
  if (status !== SHIFT.RUNNING) return false;
  if (shift.operator_id !== userId) return false;
  return new Date(shift.started_at).getTime() >= new Date(workSession.clock_in).getTime();
}

/** Pre-start done for current work session (persisted in inspections, survives refresh) */
export function hasCompletedPrestart(inspections, userId, machineId, clockIn, expectedCount = PRESTART_INSPECTION_ITEMS.length) {
  if (!clockIn || !userId || !machineId) return false;
  const n = Number(expectedCount);
  const required = Number.isFinite(n) ? n : PRESTART_INSPECTION_ITEMS.length;
  if (required <= 0) return true;
  const since = new Date(clockIn).getTime();
  const rows = inspections.filter((i) =>
    i.type === "Pre-Start Inspection" &&
    i.operator_id === userId &&
    i.machine_id === machineId &&
    new Date(i.timestamp).getTime() >= since
  );
  if (!rows.length) return false;
  const batches = new Set(rows.map((i) => i.inspection_id));
  for (const batch of batches) {
    const count = rows.filter((i) => i.inspection_id === batch).length;
    if (count >= required) return true;
  }
  return rows.length > 0;
}

/** Primary machine for v1 (Warrior 2100) — falls back to first active site machine */
export function canCloseIssue(user, issue) {
  if (!user || !issue || issue.status === ISSUE.RESOLVED) return false;
  if (user.role === ROLES.MANAGER) return true;
  return user.id === issue.reporter_id;
}

export function stopReasonToIssueArea(reason) {
  const map = {
    "Mechanical Breakdown": "Mechanical",
    "Hydraulic Breakdown": "Hydraulic",
    "Electrical Breakdown": "Electrical",
    "Engine Problem": "Engine",
    "Screen Problem": "Screen",
    "Conveyor/Belt Problem": "Conveyor",
    "Track Problem": "Tracks",
    "Waiting for Material": "Waiting for material",
    "Waiting for Loader": "Waiting for loader",
    "No Diesel": "No diesel / fuel",
    "Weather": "Weather",
    "Planned Maintenance": "Planned maintenance",
    "Safety Stop": "Safety",
    "Strike": "Strike / labour action",
  };
  return map[reason] || "Mechanical";
}

export function getPrimaryMachine(machines, siteId, siteSettings = null) {
  if (!machines?.length) return null;
  const onSite = machines.filter((m) => m.site_id === siteId && m.active !== false);
  if (siteSettings?.primary_machine_id) {
    const picked = onSite.find((m) => m.id === siteSettings.primary_machine_id);
    if (picked) return picked;
  }
  return (
    onSite.find((m) => m.code === PRIMARY_MACHINE_CODE) ||
    onSite[0] ||
    machines.find((m) => m.code === PRIMARY_MACHINE_CODE) ||
    machines[0]
  );
}

export function shiftBillableValue(shift, machines) {
  const machine = machines.find((m) => m.id === shift.machine_id);
  return Number(shift.hours_worked || 0) * Number(machine?.billable_rate || 0);
}

export function getDatePresets(cycleStartDay = 26) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const cycle = getBillingPeriod(new Date(), cycleStartDay);
  const fmt = (d) => d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short" });
  return [
    { id: "today", label: "Today", start: today, end: new Date(today.getTime() + 86400000 - 1) },
    { id: "yesterday", label: "Yesterday", start: yesterday, end: new Date(yesterday.getTime() + 86400000 - 1) },
    { id: "week", label: "This Week", start: weekStart, end: new Date() },
    { id: "month", label: "This Month", start: monthStart, end: new Date() },
    { id: "cycle", label: `Billing (${fmt(cycle.start)}–${fmt(cycle.end)})`, start: cycle.start, end: cycle.end },
  ];
}
