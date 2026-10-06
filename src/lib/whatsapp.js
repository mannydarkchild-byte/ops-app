import { formatDurationMinutes, shiftBillableHours } from "./shiftMetrics.js";

/** Build WhatsApp deep link for supervisor shift verification */
export function buildSupervisorVerifyWhatsApp(supervisorPhone, shift, machine, site, { recordedBy, events, siteSettings } = {}) {
  const phone = String(supervisorPhone || "").replace(/\D/g, "");
  if (!phone) return null;

  const base = window.location.origin + window.location.pathname;
  const verifyUrl = `${base}?verify=${encodeURIComponent(shift.id)}&token=${encodeURIComponent(shift.verification_token || "")}`;
  const meterHours = Number(shift.hours_worked || 0).toFixed(1);
  const billable = events ? shiftBillableHours(shift, events, siteSettings).toFixed(1) : null;
  const lines = [
    "OPS — Daily Shift Verification",
    "",
    `Site: ${site?.name || "—"}`,
    `Machine: ${machine?.name || shift.machine_id}`,
    `Machine operator: ${shift.operator_name}`,
    `Recorded by: ${recordedBy || shift.operator_name}`,
    `Machine hours: ${meterHours}h (${shift.start_hour_meter}h → ${shift.end_hour_meter}h)`,
    billable != null ? `Billable hours: ${billable}h (8h shift minus Darkchild downtime)` : null,
    shift.runtime_minutes != null ? `Runtime: ${formatDurationMinutes(shift.runtime_minutes)} · Downtime: ${formatDurationMinutes(shift.downtime_minutes || 0)}` : null,
    "",
    "Tap to open OPS and verify:",
    verifyUrl,
  ].filter(Boolean);

  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}

export function openWhatsApp(url) {
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
