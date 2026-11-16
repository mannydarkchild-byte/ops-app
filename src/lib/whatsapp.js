import { formatDurationMinutes } from "./shiftMetrics.js";
import { publicAppOrigin } from "./utils.js";

/** Build WhatsApp deep link for supervisor shift verification */
export function buildSupervisorVerifyWhatsApp(supervisorPhone, shift, machine, site, { recordedBy } = {}) {
  const phone = String(supervisorPhone || "").replace(/\D/g, "");
  if (!phone) return null;

  const verifyUrl = `${publicAppOrigin()}/r/${encodeURIComponent(shift.id)}/${encodeURIComponent(shift.verification_token || "")}`;
  const meterHours = Number(shift.hours_worked || 0).toFixed(1);
  const lines = [
    "OPS — Daily Shift Verification",
    "",
    `Site: ${site?.name || "—"}`,
    `Machine: ${machine?.name || shift.machine_id}`,
    `Machine operator: ${shift.operator_name}`,
    `Recorded by: ${recordedBy || shift.operator_name}`,
    `Machine hours: ${meterHours}h (${shift.start_hour_meter}h → ${shift.end_hour_meter}h)`,
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
