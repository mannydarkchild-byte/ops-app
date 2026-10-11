import { SHIFT } from "./constants.js";

/**
 * Locked shift pattern: Morning 06:00-14:00, Afternoon 14:00-22:00.
 * Pulse opens on the current shift, not the calendar day.
 * Nudge = 15 min before shift end. Auto-close grace = 30 min past turnover.
 */
export const SHIFT_WINDOWS = [
  { id: "morning", label: "Morning 06:00–14:00", short: "Morning", startHour: 6, endHour: 14, nudgeAt: "13:45" },
  { id: "afternoon", label: "Afternoon 14:00–22:00", short: "Afternoon", startHour: 14, endHour: 22, nudgeAt: "21:45" },
];

export const SHIFT_CLOSE_GRACE_MIN = 30;
export const SITE_SIGN_LINK_DAYS = 7;

export function shiftWindowForDate(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 6 && h < 14) return SHIFT_WINDOWS[0];
  if (h >= 14 && h < 22) return SHIFT_WINDOWS[1];
  // Night 22:00-06:00: no active shift — show the next (morning) window.
  return SHIFT_WINDOWS[0];
}

export function currentShiftWindow(now = new Date()) {
  return shiftWindowForDate(now);
}

/**
 * Dual sign-off agreement for one shift.
 * Operator submits -> machine supervisor signs (MACHINE_SIGNED, version locked)
 * -> site supervisor signs via link (VERIFIED = dual-signed, billable).
 * Legacy single-signed VERIFIED shifts (no site signature) stay honest: flagged legacy.
 */
export function getShiftAgreement(shift) {
  const status = shift?.shift_status || shift?.status || null;
  const machineSigned = !!(
    shift?.machine_signature_ref ||
    shift?.machine_signature_name ||
    shift?.machine_signed_at ||
    // Legacy: old single supervisor signature counts as machine-side.
    shift?.supervisor_signature_ref ||
    shift?.supervisor_signature_name
  );
  const siteSigned = !!(
    shift?.site_signature_name ||
    shift?.site_signed_at
  );
  const dualSigned = status === SHIFT.VERIFIED && machineSigned && siteSigned;
  const legacySingleSigned = status === SHIFT.VERIFIED && machineSigned && !siteSigned;
  return {
    status,
    machineSigned,
    siteSigned,
    dualSigned,
    legacySingleSigned,
    awaitingMachine: [SHIFT.WAITING_FOR_VERIFICATION, SHIFT.RESUBMITTED, SHIFT.SUBMITTED].includes(status),
    awaitingSite: status === SHIFT.MACHINE_SIGNED,
    blocked: [SHIFT.WAITING_FOR_VERIFICATION, SHIFT.RESUBMITTED, SHIFT.SUBMITTED, SHIFT.MACHINE_SIGNED].includes(status),
    version: Number(shift?.shift_version || 1),
  };
}

export function agreementLabel(shift) {
  const a = getShiftAgreement(shift);
  if (a.dualSigned) return "Signed by both";
  if (a.legacySingleSigned) return "Needs Berlington sign";
  if (a.awaitingSite) return "Needs Berlington sign";
  if (a.awaitingMachine) return "Needs your sign";
  if (a.status === SHIFT.CORRECTION_REQUIRED) return "Sent back for correction";
  if (a.status === SHIFT.RUNNING) return "Running";
  return a.status || "—";
}

/** Public site sign-off link shared over WhatsApp. Token is the auth. */
export function siteSignLink(shift, origin) {
  const base = (origin || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");
  return `${base}/?sign=${encodeURIComponent(shift.id)}&token=${encodeURIComponent(shift.site_token || "")}`;
}

export function whatsappShareUrl(phone, text) {
  const body = encodeURIComponent(text);
  return phone ? `https://wa.me/${encodeURIComponent(phone)}?text=${body}` : `https://wa.me/?text=${body}`;
}

export function needsBerlingtonSign(shift) {
  const a = getShiftAgreement(shift);
  return a.awaitingSite || a.legacySingleSigned;
}

export function siteSignShareText(shift, machineName, link, ownerName = "Berlington") {
  const hours = Number(shift?.hours_worked || 0).toFixed(1);
  const when = shift?.started_at ? new Date(shift.started_at).toLocaleDateString("en-ZA") : "";
  return (
    `OPS shift report — ${machineName || "Machine"} · ${when} · ${hours}h. ` +
    `${ownerName} supervisor: tap to sign: ${link}`
  );
}
