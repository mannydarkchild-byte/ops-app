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

/** User-facing sync error (title + body + optional technical detail) */
export function parseSyncError(raw) {
  if (!raw || raw === "offline") {
    return {
      title: "You’re offline",
      body: "Work is saved on this phone. It will send when you have signal.",
      technical: null,
    };
  }

  const s = String(raw);
  const mediaDetail = s.replace(/^MEDIA_[^:]+:\s*/i, "").trim();
  const isMedia = /^MEDIA_/i.test(s) || s.includes("Photo ");

  if (isMedia) {
    if (/row-level security|policy|403|401|permission|JWT/i.test(mediaDetail)) {
      return {
        title: "Photo didn’t save",
        body: "Your shift numbers can still send — tap Update again. Ask the office to fix photo storage (ops-media) in Supabase.",
        technical: mediaDetail || s,
      };
    }
    if (/Bucket not found|not found/i.test(mediaDetail)) {
      return {
        title: "Photo storage missing",
        body: "The ops-media bucket is not set up in Supabase.",
        technical: mediaDetail || s,
      };
    }
    if (/Payload too large|413|size/i.test(mediaDetail)) {
      return {
        title: "Photo too large",
        body: "Take a smaller picture or continue without that photo.",
        technical: mediaDetail || s,
      };
    }
    return {
      title: "Photo didn’t save",
      body: "Your shift can still send without the photo.",
      technical: mediaDetail || s,
    };
  }

  if (/photo_ref|schema cache|could not find the/i.test(s)) {
    return {
      title: "Photo field mismatch",
      body: "The app sent a photo column the database does not have. Update the app, then tap Update again.",
      technical: s,
    };
  }

  if (/shift_submissions|row-level security/i.test(s) && /shift_submission|submission/i.test(s)) {
    return {
      title: "Shift sign-off record blocked",
      body: "Server permissions blocked the submission row. Run migration 014 in Supabase, and confirm your profile has the correct site.",
      technical: s,
    };
  }

  if (/issue_messages|schema cache|could not find the/i.test(s)) {
    return {
      title: "Issue message didn’t send",
      body: "Run migration 012 in Supabase (issue_messages media columns), then tap Update.",
      technical: s,
    };
  }

  if (s.includes("/") && s.includes(":")) {
    const [where, msg] = s.split(/:\s*/, 2);
    return {
      title: "Could not save",
      body: `${where.replace(/\//g, " · ")}`,
      technical: msg || s,
    };
  }

  return { title: "Update problem", body: "Tap Update to try again.", technical: s };
}

/** @deprecated use parseSyncError */
export function formatSyncErrorMessage(raw) {
  const p = parseSyncError(raw);
  return p.technical ? `${p.title}. ${p.body} (${p.technical})` : `${p.title}. ${p.body}`;
}
