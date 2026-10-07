import { formatDurationMinutes, shiftBillableHours } from "./shiftMetrics.js";
import { fmtDateShort, isLiveSince, money, shiftBillableValue } from "./utils.js";

function formatTonnes(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  return num % 1 === 0 ? String(num) : num.toFixed(1);
}

/** Build on-site-now rows: clocked-in people + machines still running. */
export function buildOnSiteDetail({ workSessions, fleetStatus, siteId }) {
  const rows = [];
  for (const s of (workSessions || []).filter(
    (ws) => ws.status === "active" && ws.site_id === siteId && isLiveSince(ws.clock_in)
  )) {
    rows.push({
      id: `ws-${s.id}`,
      title: s.operator_name || "Operator",
      meta: `Clocked in ${s.clock_in ? new Date(s.clock_in).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) : ""}`,
      value: "On site",
      tone: "#F5C518",
    });
  }
  for (const f of (fleetStatus || []).filter((x) => x.runningShift)) {
    const shift = f.runningShift;
    rows.push({
      id: `run-${shift.id}`,
      title: shift.operator_name || "Operator",
      meta: `${f.machine?.name || "Machine"} · ${f.isStopped ? "Stopped" : "Running"}`,
      value: f.isStopped ? "Stopped" : "Running",
      tone: f.isStopped ? "#EF4444" : "#22C55E",
    });
  }
  return rows;
}

export function buildShiftListDetail(shifts, { machines, events, siteConfig, mode = "billable" }) {
  return (shifts || []).map((s) => {
    const machine = (machines || []).find((m) => m.id === s.machine_id);
    const billable = shiftBillableHours(s, events, siteConfig);
    const machineH = Number(s.hours_worked || 0);
    const revenue = shiftBillableValue(s, machines, events, siteConfig);
    let value = `${billable.toFixed(1)}h`;
    if (mode === "machine") value = `${machineH.toFixed(1)}h`;
    if (mode === "revenue") value = money(revenue);
    if (mode === "downtime") value = formatDurationMinutes(Number(s.downtime_minutes || 0));
    if (mode === "runtime") value = formatDurationMinutes(Number(s.runtime_minutes || 0));
    return {
      id: s.id,
      title: s.operator_name || "Operator",
      meta: `${machine?.name || s.machine_id || "Machine"} · ${fmtDateShort(s.ended_at || s.started_at)} · ${s.shift_status || ""}`,
      value,
      tone: mode === "downtime" ? "#EF4444" : "#22C55E",
    };
  });
}

export function buildPendingVerifyDetail(shifts, machines) {
  return (shifts || []).map((s) => {
    const machine = (machines || []).find((m) => m.id === s.machine_id);
    return {
      id: s.id,
      title: s.operator_name || "Operator",
      meta: `${machine?.name || "Machine"} · ${fmtDateShort(s.ended_at || s.submitted_at)} · ${s.assigned_supervisor_name || "Unassigned"}`,
      value: "Needs sign-off",
      tone: "#F5C518",
    };
  });
}

export function buildExpenseDetail(expenses) {
  return (expenses || []).map((e) => ({
    id: e.id,
    title: e.category || "Expense",
    meta: `${fmtDateShort(e.date || e.created_at)}${e.note ? ` · ${e.note}` : ""}${e.vendor ? ` · ${e.vendor}` : ""}`,
    value: money(e.amount),
    tone: "#F5C518",
  }));
}

export function buildDieselDetail(fuelLogs, machines) {
  return (fuelLogs || []).map((f) => {
    const machine = (machines || []).find((m) => m.id === f.machine_id);
    return {
      id: f.id,
      title: machine?.name || "Machine",
      meta: `${fmtDateShort(f.timestamp)} · ${f.operator_name || f.recorded_by_name || "Logged"}`,
      value: `${Number(f.litres || 0).toFixed(1)} L`,
      tone: "#F5C518",
    };
  });
}

export function buildTonnageDetail(rows, mode = "tonnes") {
  return (rows || []).map((r) => ({
    id: r.id,
    title: `${fmtDateShort(r.shift_date || r.period_start)} · ${r.shift_band === "night" ? "Night" : "Day"}`,
    meta: `${r.submitted_by_name || "Supervisor"}${r.photo_ref || r.photo_url ? " · photo on file" : ""}`,
    value: mode === "trucks"
      ? `${Number(r.trucks_loaded) || 0} trucks`
      : `${formatTonnes(r.total_tonnes)} t`,
    tone: "#F5C518",
  }));
}

export function buildIssuesDetail(issues) {
  return (issues || []).map((i) => ({
    id: i.id,
    title: i.title || i.area || "Problem",
    meta: `${i.priority || "Medium"} · ${i.status || ""} · ${i.reporter_name || ""}`,
    value: i.priority === "Critical" ? "Critical" : i.status,
    tone: i.priority === "Critical" ? "#EF4444" : "#F97316",
  }));
}
