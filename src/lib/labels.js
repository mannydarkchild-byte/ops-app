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
};
