import { fmtDateShort, inPeriod } from "./utils.js";

export function sessionHours(session, now = Date.now()) {
  if (!session?.clock_in) return 0;
  const start = new Date(session.clock_in).getTime();
  const end = session.clock_out ? new Date(session.clock_out).getTime() : now;
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, (end - start) / 3600000);
}

export function timesheetStatusLabel(status) {
  if (status === "active") return "On site";
  if (status === "ended_early") return "Left without starting";
  if (status === "ended") return "Clocked out";
  return status || "—";
}

export function fmtClockTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

export function buildTimesheetRows(workSessions, { siteId, period } = {}) {
  return (workSessions || [])
    .filter((s) => !siteId || s.site_id === siteId)
    .filter((s) => !period || inPeriod(s.clock_in, period))
    .sort((a, b) => new Date(b.clock_in || 0) - new Date(a.clock_in || 0))
    .map((s) => ({
      ...s,
      hours: sessionHours(s),
      statusLabel: timesheetStatusLabel(s.status),
      dateLabel: fmtDateShort(s.clock_in),
      inLabel: fmtClockTime(s.clock_in),
      outLabel: s.clock_out ? fmtClockTime(s.clock_out) : "—",
    }));
}

export function summarizeTimesheet(rows) {
  const hours = rows.reduce((sum, r) => sum + Number(r.hours || 0), 0);
  const onSite = rows.filter((r) => r.status === "active").length;
  const leftEarly = rows.filter((r) => r.status === "ended_early").length;
  const ended = rows.filter((r) => r.status === "ended").length;
  const byOperator = {};
  for (const r of rows) {
    const key = r.operator_id || r.operator_name || "unknown";
    if (!byOperator[key]) {
      byOperator[key] = {
        operator_id: r.operator_id,
        operator_name: r.operator_name || "Operator",
        hours: 0,
        sessions: 0,
        leftEarly: 0,
      };
    }
    byOperator[key].hours += Number(r.hours || 0);
    byOperator[key].sessions += 1;
    if (r.status === "ended_early") byOperator[key].leftEarly += 1;
  }
  return {
    hours,
    sessions: rows.length,
    onSite,
    leftEarly,
    ended,
    byOperator: Object.values(byOperator).sort((a, b) => b.hours - a.hours),
  };
}
