import { fmtDateShort, inPeriod } from "./utils.js";

export const STANDARD_SITE_HOURS = 8;
export const SITE_HOURS_REMIND_AFTER = 7;
export const OVERTIME_ACK_TAG = "[overtime-ack]";
export const AUTO_CLOCK_OUT_NOTE = "Auto clocked out after 8 hours";

export function sessionHours(session, now = Date.now()) {
  if (!session?.clock_in) return 0;
  const start = new Date(session.clock_in).getTime();
  const end = session.clock_out ? new Date(session.clock_out).getTime() : now;
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, (end - start) / 3600000);
}

export function overtimeHours(session, now = Date.now()) {
  return Math.max(0, sessionHours(session, now) - STANDARD_SITE_HOURS);
}

export function hasOvertimeAck(session) {
  return String(session?.notes || "").includes(OVERTIME_ACK_TAG);
}

export function wasAutoClockedOut(session) {
  return String(session?.notes || "").includes(AUTO_CLOCK_OUT_NOTE);
}

export function displaySessionNotes(notes) {
  return String(notes || "")
    .replaceAll(OVERTIME_ACK_TAG, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function standardClockOutAt(session) {
  const start = new Date(session?.clock_in).getTime();
  if (Number.isNaN(start)) return null;
  return new Date(start + STANDARD_SITE_HOURS * 3600000).toISOString();
}

export function shouldRemindSiteHours(session, now = Date.now()) {
  return session?.status === "active" && sessionHours(session, now) >= SITE_HOURS_REMIND_AFTER;
}

export function shouldOfferEightHourChoice(session, now = Date.now()) {
  return session?.status === "active"
    && !hasOvertimeAck(session)
    && sessionHours(session, now) >= STANDARD_SITE_HOURS;
}

export function shouldAutoClockOut(session, { hasOpenShift = false } = {}, now = Date.now()) {
  if (hasOpenShift) return false;
  return shouldOfferEightHourChoice(session, now);
}

export function timesheetStatusLabel(status, session) {
  if (wasAutoClockedOut(session)) return "Auto clocked out (8h)";
  if (status === "active" && overtimeHours(session) > 0) return "On site · overtime";
  if (status === "active") return "On site";
  if (status === "ended_early") return "Left without starting";
  if (status === "ended" && overtimeHours(session) > 0) return "Clocked out · overtime";
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
      overtimeHours: overtimeHours(s),
      autoClosed: wasAutoClockedOut(s),
      statusLabel: timesheetStatusLabel(s.status, s),
      notes: displaySessionNotes(s.notes),
      dateLabel: fmtDateShort(s.clock_in),
      inLabel: fmtClockTime(s.clock_in),
      outLabel: s.clock_out ? fmtClockTime(s.clock_out) : "—",
    }));
}

export function summarizeTimesheet(rows) {
  const hours = rows.reduce((sum, r) => sum + Number(r.hours || 0), 0);
  const overtime = rows.reduce((sum, r) => sum + Number(r.overtimeHours || 0), 0);
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
        overtimeHours: 0,
        sessions: 0,
        leftEarly: 0,
      };
    }
    byOperator[key].hours += Number(r.hours || 0);
    byOperator[key].overtimeHours += Number(r.overtimeHours || 0);
    byOperator[key].sessions += 1;
    if (r.status === "ended_early") byOperator[key].leftEarly += 1;
  }
  return {
    hours,
    overtimeHours: overtime,
    sessions: rows.length,
    onSite,
    leftEarly,
    ended,
    byOperator: Object.values(byOperator).sort((a, b) => b.hours - a.hours),
  };
}
