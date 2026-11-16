import { supabase } from "./supabase.js";

const LOGIN_KEY = "ops-login-id";
const CLAIM_AT_KEY = "ops-login-claim-at";
const CLAIM_GRACE_MS = 60_000;

export function getLocalLoginId() {
  try { return localStorage.getItem(LOGIN_KEY); } catch { return null; }
}

export function rememberLocalLoginId(id) {
  try { localStorage.setItem(LOGIN_KEY, id); } catch {}
}

export function clearLocalLoginId() {
  try { localStorage.removeItem(LOGIN_KEY); } catch {}
  try { sessionStorage.removeItem(CLAIM_AT_KEY); } catch {}
}

function newLoginId() {
  return crypto.randomUUID?.() || `login-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function markClaimedNow() {
  try { sessionStorage.setItem(CLAIM_AT_KEY, String(Date.now())); } catch {}
}

/** True while this phone is taking the seat — do not sign it out. */
export function recentlyClaimed(withinMs = CLAIM_GRACE_MS) {
  try {
    const at = Number(sessionStorage.getItem(CLAIM_AT_KEY) || 0);
    return Boolean(at && Date.now() - at < withinMs);
  } catch {
    return false;
  }
}

/** Call before password sign-in so this device is never kicked mid-login. */
export function beginLoginClaim() {
  const id = getLocalLoginId() || newLoginId();
  rememberLocalLoginId(id);
  markClaimedNow();
  return id;
}

/** Password sign-in: this device becomes the only live login. */
export async function claimDeviceLogin(userId) {
  if (!userId) return getLocalLoginId();
  const id = beginLoginClaim();
  if (!navigator.onLine) return id;
  const { error } = await supabase.from("profiles").update({
    active_login_id: id,
    active_login_at: new Date().toISOString(),
  }).eq("id", userId);
  if (error) {
    console.warn("claimDeviceLogin:", error.message);
  }
  return id;
}

/** First visit after the column exists: take the seat only if nobody holds it. */
export async function adoptDeviceLogin(userId, profile) {
  if (!userId || !navigator.onLine) return getLocalLoginId();
  const local = getLocalLoginId();
  if (profile?.active_login_id && local && profile.active_login_id === local) return local;
  if (recentlyClaimed()) return local || claimDeviceLogin(userId);
  if (profile?.active_login_id && local && profile.active_login_id !== local) return local;
  if (!profile?.active_login_id) return claimDeviceLogin(userId);
  if (!local) return claimDeviceLogin(userId);
  return local;
}

export function isTakenOver(profile) {
  if (recentlyClaimed()) return false;
  const local = getLocalLoginId();
  if (!profile?.active_login_id || !local) return false;
  return profile.active_login_id !== local;
}
