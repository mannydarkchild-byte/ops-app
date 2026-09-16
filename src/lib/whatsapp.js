/** Build WhatsApp deep link for supervisor shift verification */
export function buildSupervisorVerifyWhatsApp(supervisorPhone, shift, machine, site) {
  const phone = String(supervisorPhone || "").replace(/\D/g, "");
  if (!phone) return null;

  const base = window.location.origin + window.location.pathname;
  const verifyUrl = `${base}?verify=${encodeURIComponent(shift.id)}&token=${encodeURIComponent(shift.verification_token || "")}`;
  const meterHours = Number(shift.hours_worked || 0).toFixed(1);
  const lines = [
    "OPS — Daily Shift Verification",
    "",
    `Site: ${site?.name || "—"}`,
    `Operator: ${shift.operator_name}`,
    `Machine: ${machine?.name || shift.machine_id}`,
    `Meter hours: ${meterHours}h (${shift.start_hour_meter}h → ${shift.end_hour_meter}h)`,
    shift.runtime_minutes != null ? `Runtime: ${Math.round(shift.runtime_minutes)}m · Downtime: ${Math.round(shift.downtime_minutes || 0)}m` : null,
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
