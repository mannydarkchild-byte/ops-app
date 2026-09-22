import { SHIFT } from "./constants.js";
import { getShiftStatus } from "./utils.js";

/** Plain-language shift status for screens (not database values) */
export function shiftStatusLabel(shift) {
  const status = getShiftStatus(shift);
  switch (status) {
    case SHIFT.RUNNING: return "Running";
    case SHIFT.WAITING_FOR_VERIFICATION: return "Waiting for sign-off";
    case SHIFT.CORRECTION_REQUIRED: return "Operator fixing";
    case SHIFT.RESUBMITTED: return "Fixed — check again";
    case SHIFT.VERIFIED: return "Signed off";
    default: return status?.replace(/_/g, " ") || "Unknown";
  }
}

export const SYNC_LABELS = {
  synced: "Up to date",
  syncing: "Updating…",
  offline: "Offline",
  error: "Upload failed",
  idle: "Ready",
  /** Short header / tab bar action */
  action: "Update",
  actionRetry: "Retry",
};

/** One-line label for the sync control (header, tab bar) */
export function syncControlLabel({ status, pending, errors }) {
  if (status === "syncing") return SYNC_LABELS.syncing;
  if (errors?.length || status === "error") return SYNC_LABELS.actionRetry;
  if (pending > 0) return SYNC_LABELS.action;
  if (status === "offline") return SYNC_LABELS.offline;
  if (status === "synced") return SYNC_LABELS.synced;
  return SYNC_LABELS.action;
}

/** Longer line for mobile banner (includes count) */
export function syncBannerLine({ status, pending, errors }) {
  const n = pending || 0;
  if (status === "syncing" && n > 0) return `Sending… ${n} left`;
  if (errors?.length || status === "error") return SYNC_LABELS.error;
  if (n > 0) return `${n} item${n === 1 ? "" : "s"} waiting to send`;
  if (status === "syncing") return SYNC_LABELS.syncing;
  return syncControlLabel({ status, pending, errors });
}

/** Full sentence for sync error list (mobile-readable) */
export function formatSyncErrorMessage(raw) {
  if (!raw || raw === "offline") return "No signal — will send when you are back online.";
  const s = String(raw);
  if (/^MEDIA_/i.test(s) || s.includes("Photo ")) {
    const detail = s.replace(/^MEDIA_[^:]+:\s*/i, "").trim();
    if (/row-level security|policy|403|401|permission|JWT/i.test(detail)) {
      return `Photo could not upload (server storage blocked). Your shift numbers can still send — tap Update again. Admin must allow ops-media uploads for signed-in users. (${detail})`;
    }
    if (/Bucket not found|not found/i.test(detail)) {
      return `Photo bucket missing in Supabase (ops-media). (${detail})`;
    }
    if (/Payload too large|413|size/i.test(detail)) {
      return `Photo file too large for upload. Take a smaller picture or skip the photo. (${detail})`;
    }
    return `Photo upload failed: ${detail || s}`;
  }
  if (s.includes("/") && s.includes(":")) {
    const [where, msg] = s.split(/:\s*/, 2);
    return `${where.replace(/\//g, " — ")}: ${msg || "Could not save"}`;
  }
  return s;
}
