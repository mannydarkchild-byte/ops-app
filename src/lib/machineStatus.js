import { supabase } from "./supabase.js";
import { dropLocalRecord, ensureDB, mergeServerRow } from "./db.js";
import { SHIFT } from "./constants.js";

function isLocalRunning(shift) {
  return shift?.shift_status === SHIFT.RUNNING || shift?.status === SHIFT.RUNNING;
}

/** Status poll — skip photo columns so a live refresh stays cheap on mobile data. */
const OPEN_SHIFT_SELECT = [
  "id", "site_id", "machine_id", "operator_id", "operator_name", "organization_id",
  "assigned_supervisor_id", "assigned_supervisor_name", "shift_status",
  "started_at", "ended_at", "start_hour_meter", "end_hour_meter",
  "hours_worked", "runtime_minutes", "downtime_minutes", "created_at", "updated_at",
].join(",");

/** Every RUNNING row for this machine. `.shift` is the newest. An empty list means the server has none. */
export async function fetchServerOpenShift(machineId) {
  if (!navigator.onLine || !machineId) return { known: false, shift: null, shifts: [] };
  const { data, error } = await supabase
    .from("shifts")
    .select(OPEN_SHIFT_SELECT)
    .eq("machine_id", machineId)
    .eq("shift_status", SHIFT.RUNNING)
    .order("started_at", { ascending: false });
  if (error) return { known: false, shift: null, shifts: [] };
  const shifts = data || [];
  return { known: true, shift: shifts[0] || null, shifts };
}

/** All leftover RUNNING shifts on the server — Live tab uses this so close is visible. */
export async function fetchServerOpenShifts() {
  if (!navigator.onLine) return { known: false, shifts: [] };
  const { data, error } = await supabase
    .from("shifts")
    .select(OPEN_SHIFT_SELECT)
    .eq("shift_status", SHIFT.RUNNING)
    .order("started_at", { ascending: false });
  if (error) return { known: false, shifts: [] };
  return { known: true, shifts: data || [] };
}

export const VERIFY_ONCE_KEY = "ops_verify_once";

export function normalizeShiftLinkId(raw) {
  let id = String(raw || "").trim();
  for (let i = 0; i < 2; i += 1) {
    try {
      const next = decodeURIComponent(id);
      if (next === id) break;
      id = next;
    } catch {
      break;
    }
  }
  return id.replace(/[).,;]+$/g, "").trim();
}

function looksLikeLink(value) {
  const text = String(value || "");
  return /^https?:/i.test(text) || text.includes("://") || text.includes("?verify=") || text.includes("/r/") || text.includes("&token=");
}

function pickShiftId(value) {
  const text = normalizeShiftLinkId(value);
  if (!text || looksLikeLink(text)) return "";
  if (text.includes("&token=")) return normalizeShiftLinkId(text.split("&token=")[0]);
  return text;
}

/** WhatsApp often wraps or nests the URL. Pull id + token out of that mess. */
export function parseVerifyLink(shiftId, token) {
  let id = pickShiftId(shiftId);
  let tok = pickShiftId(token);
  const blob = [shiftId, token].filter(Boolean).join(" ");

  const fromText = (text) => {
    if (!text) return;
    try {
      const url = new URL(String(text).trim(), "https://opsapp.africa");
      const path = url.pathname.match(/\/r\/([^/]+)(?:\/([^/]+))?/);
      if (path) {
        id = id || pickShiftId(path[1]);
        tok = tok || pickShiftId(path[2] || "");
      }
      id = id || pickShiftId(url.searchParams.get("verify") || url.searchParams.get("v") || "");
      tok = tok || pickShiftId(url.searchParams.get("token") || url.searchParams.get("t") || "");
    } catch {}
    const nested = String(text).match(/[?&](?:verify|v)=([^&\s]+)/i);
    const nestedTok = String(text).match(/[?&](?:token|t)=([^&\s]+)/i);
    if (nested) id = id || pickShiftId(nested[1]);
    if (nestedTok) tok = tok || pickShiftId(nestedTok[1]);
  };

  fromText(shiftId);
  fromText(token);
  fromText(blob);
  return { id, tok };
}

export function hasPendingVerifyLink() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("verify") || params.has("v") || params.has("token")) return true;
    if (/^\/r\//.test(window.location.pathname || "")) return true;
    return Boolean(sessionStorage.getItem(VERIFY_ONCE_KEY));
  } catch {
    return false;
  }
}

async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession();
  const exp = Number(session?.expires_at || 0);
  const fresh = exp ? exp * 1000 > Date.now() + 15_000 : Boolean(session?.access_token);
  if (fresh) return session;
  const { data } = await supabase.auth.refreshSession();
  return data?.session || session || null;
}

async function waitForSession(ms = 8000) {
  const started = Date.now();
  let session = await ensureSession();
  while (!session && Date.now() - started < ms) {
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    session = await ensureSession();
  }
  return session;
}

async function persistShift(row) {
  if (!row) return null;
  try { await mergeServerRow("shifts", row); } catch {}
  return row;
}

async function findLocalShift(id, tok) {
  try {
    const db = await ensureDB();
    const rows = await db.shifts.toArray();
    return rows.find((s) =>
      (id && s.id === id)
      || (tok && (s.verification_token === tok || s.site_token === tok))
      || (id && id.length >= 12 && String(s.id || "").startsWith(id))
    ) || null;
  } catch {
    return null;
  }
}

export async function fetchShiftById(shiftId) {
  const id = normalizeShiftLinkId(shiftId);
  if (!navigator.onLine || !id) return null;
  await ensureSession();
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return persistShift(data);
}

async function fetchShiftByToken(tok) {
  if (!tok) return null;
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("verification_token", tok)
    .maybeSingle();
  if (!error && data) return persistShift(data);
  const site = await supabase
    .from("shifts")
    .select("*")
    .eq("site_token", tok)
    .maybeSingle();
  if (!site.error && site.data) return persistShift(site.data);
  return null;
}

async function fetchShiftByPrefix(id) {
  if (!id || id.length < 12) return null;
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .like("id", `${id}%`)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error || !data?.[0]) return null;
  return persistShift(data[0]);
}

async function fetchRecentMatch(id, tok) {
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(80);
  if (error || !data?.length) return { row: null, visible: !error && Array.isArray(data), error };
  const row = data.find((s) =>
    (id && s.id === id)
    || (tok && (s.verification_token === tok || s.site_token === tok))
    || (id && String(s.id || "").startsWith(id))
  ) || null;
  return { row: row ? await persistShift(row) : null, visible: true, error: null };
}

async function fetchViaRpc(id, tok) {
  const { data, error } = await supabase.rpc("shift_for_verify", {
    p_shift_id: id || null,
    p_token: tok || null,
  });
  if (error) return { row: null, missing: /could not find the function|schema cache|does not exist|PGRST202/i.test(error.message || "") };
  const row = Array.isArray(data) ? data[0] : data;
  return { row: row ? await persistShift(row) : null, missing: false };
}

function endedRecently(shift, hours = 48) {
  const at = new Date(shift?.ended_at || shift?.updated_at || shift?.started_at || 0).getTime();
  return Number.isFinite(at) && Date.now() - at < hours * 3600 * 1000;
}

function matchShiftRow(shift, id, tok) {
  if (!shift) return false;
  if (tok && (shift.verification_token === tok || shift.site_token === tok)) return true;
  if (id && shift.id === id) return true;
  if (id && id.length >= 12 && String(shift.id || "").startsWith(id)) return true;
  return false;
}

function pickWaitingShift(rows, id, tok, userId) {
  const list = rows || [];
  const exact = list.find((s) => matchShiftRow(s, id, tok));
  if (exact) return exact;
  const recent = list.filter((s) => endedRecently(s, 48));
  const mine = recent.filter((s) => userId && s.assigned_supervisor_id === userId);
  if (mine[0]) return mine[0];
  if (recent[0]) return recent[0];
  return list[0] || null;
}

async function fetchWaitingShifts() {
  const statuses = [
    SHIFT.WAITING_FOR_VERIFICATION,
    SHIFT.MACHINE_SIGNED,
    SHIFT.RESUBMITTED,
    SHIFT.SUBMITTED,
  ];
  const rpc = await supabase.rpc("shifts_waiting_verify");
  let rows = [];
  if (!rpc.error && Array.isArray(rpc.data)) rows = rpc.data;
  if (!rows.length) {
    const { data, error } = await supabase
      .from("shifts")
      .select("*")
      .in("shift_status", statuses)
      .order("ended_at", { ascending: false })
      .limit(40);
    if (!error) rows = data || [];
  }
  for (const row of rows) {
    await persistShift(row);
  }
  return rows;
}

/** WhatsApp verify link: local Dexie, token RPC, then authenticated reads. */
export async function loadShiftFromVerifyLink(shiftId, token, viewer = null) {
  const { id, tok } = parseVerifyLink(shiftId, token);
  if (!id && !tok) throw new Error("This report link is missing the shift id.");

  const local = await findLocalShift(id, tok);
  if (local) return local;

  if (!navigator.onLine) {
    throw new Error("Need a connection to open this report. Check signal and tap Try again.");
  }

  let rpc = await fetchViaRpc(id, tok);
  if (rpc.row) return rpc.row;
  if (rpc.missing) {
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    rpc = await fetchViaRpc(id, tok);
    if (rpc.row) return rpc.row;
  }

  const session = await waitForSession();
  const userId = viewer?.id || session?.user?.id || null;

  if (id) {
    const byId = await fetchShiftById(id);
    if (byId) return byId;
    const prefixed = await fetchShiftByPrefix(id);
    if (prefixed) return prefixed;
  }
  if (tok) {
    const byToken = await fetchShiftByToken(tok);
    if (byToken) return byToken;
  }

  const recent = await fetchRecentMatch(id, tok);
  if (recent.row) return recent.row;

  const waiting = await fetchWaitingShifts();
  const chosen = pickWaitingShift(waiting, id, tok, userId);
  if (chosen) return persistShift(chosen);

  if (!session) {
    throw new Error("Sign in, then open this WhatsApp link again.");
  }
  throw new Error("This report is not on the server yet. On the operator phone, open OPS and tap Update, then open the link again.");
}

export async function hydrateOpenShiftsFromServer() {
  const remote = await fetchServerOpenShifts();
  if (!remote.known) return remote;
  for (const shift of remote.shifts) {
    try { await mergeServerRow("shifts", shift); } catch {}
  }
  return remote;
}

/**
 * Pulse Refresh. Incremental sync can skip rows once its watermark is ahead of them,
 * so this reads the machine's recent shifts and stops straight from the server.
 */
export async function refreshMachineActivity(machineId) {
  if (!navigator.onLine || !machineId) return { ok: false, reason: "offline" };

  const { data: shiftRows, error: shiftError } = await supabase
    .from("shifts")
    .select("*")
    .eq("machine_id", machineId)
    .order("started_at", { ascending: false })
    .limit(120);
  if (shiftError) throw new Error(shiftError.message || "Could not load shifts");

  const shifts = shiftRows || [];
  for (const row of shifts) {
    await mergeServerRow("shifts", row);
  }

  const { data: eventRows, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("machine_id", machineId)
    .order("timestamp", { ascending: false })
    .limit(400);
  if (eventError) throw new Error(eventError.message || "Could not load stops");

  const events = [...(eventRows || [])];
  const seen = new Set(events.map((row) => row.id));
  const shiftIds = shifts.slice(0, 40).map((row) => row.id).filter(Boolean);
  if (shiftIds.length) {
    const { data: byShift, error: byShiftError } = await supabase
      .from("events")
      .select("*")
      .in("shift_id", shiftIds);
    if (byShiftError) throw new Error(byShiftError.message || "Could not load shift activity");
    for (const row of byShift || []) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      events.push(row);
    }
  }

  for (const row of events) {
    await mergeServerRow("events", row);
  }

  return { ok: true, shifts: shifts.length, events: events.length };
}

/** Keep a local RUNNING row until the server agrees it is closed. An empty server list often means the new shift has not uploaded yet. */
async function localRunMustBeKept(shift) {
  const db = await ensureDB();
  const queued = await db.sync_queue
    .filter((q) => q.table === "shifts" && q.record_id === shift.id)
    .first();
  if (queued) return true;
  const started = new Date(shift.started_at || shift.created_at || 0).getTime();
  if (!Number.isFinite(started) || Date.now() - started < 2 * 60 * 1000) return true;
  if (!navigator.onLine) return true;
  const { data, error } = await supabase
    .from("shifts")
    .select("shift_status")
    .eq("id", shift.id)
    .maybeSingle();
  if (error) return true;
  if (!data) return false;
  return data.shift_status === SHIFT.RUNNING;
}

async function dropLocalRunningShifts(machineId, keepId = null) {
  const db = await ensureDB();
  const locals = (await db.shifts.toArray()).filter(
    (s) => s.machine_id === machineId && isLocalRunning(s) && s.id !== keepId
  );
  let dropped = 0;
  for (const shift of locals) {
    if (await localRunMustBeKept(shift)) continue;
    await dropLocalRecord("shifts", shift.id);
    dropped += 1;
  }
  return dropped;
}

/** Drop local RUNNING rows that are not this operator’s current clock-in. */
export async function clearStaleLocalRuns(machineId, workSession, userId) {
  if (!machineId) return 0;
  const db = await ensureDB();
  const locals = (await db.shifts.toArray()).filter((s) => s.machine_id === machineId && isLocalRunning(s));
  let dropped = 0;
  for (const shift of locals) {
    const belongs = userId
      && workSession
      && shift.operator_id === userId
      && new Date(shift.started_at).getTime() >= new Date(workSession.clock_in).getTime();
    if (belongs) continue;
    if (await localRunMustBeKept(shift)) continue;
    await dropLocalRecord("shifts", shift.id);
    dropped += 1;
  }
  if (dropped) await db.machine_locks.delete(machineId);
  return dropped;
}

/** Align the phone with the server. A local open shift stays until the server shows that same shift is no longer running. */
export async function reconcileMachineOpenState(machineId) {
  const db = await ensureDB();
  const remote = await fetchServerOpenShift(machineId);

  if (remote.known && !remote.shift) {
    await dropLocalRunningShifts(machineId);
    const stillOpen = (await db.shifts.toArray()).some(
      (s) => s.machine_id === machineId && isLocalRunning(s)
    );
    if (stillOpen) {
      return { ...remote, status: null, cleared: false };
    }
    try {
      await supabase.rpc("stop_machine", { p_machine_id: machineId });
    } catch {}
    await db.machine_locks.delete(machineId);
    const cached = await db.machine_status.get(machineId);
    const cleared = {
      ...(cached || { machine_id: machineId }),
      machine_id: machineId,
      is_running: false,
      shift_id: null,
      operator_id: null,
      operator_name: null,
      _cached_at: new Date().toISOString(),
    };
    await db.machine_status.put(cleared);
    return { ...remote, status: cleared, cleared: true };
  }

  return { ...remote, status: null, cleared: false };
}

/** Fetch machine_status from server and cache locally. Clears a stuck running flag when no shift is open. */
export async function fetchMachineStatus(machineId) {
  if (!machineId) return null;

  const db = await ensureDB();
  const reconciled = await reconcileMachineOpenState(machineId);
  if (reconciled.cleared && reconciled.status) return reconciled.status;

  if (navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from("machine_status")
        .select("*")
        .eq("machine_id", machineId)
        .maybeSingle();
      if (!error && data) {
        const status = data.is_running && reconciled.known && !reconciled.shift
          ? { ...data, is_running: false, shift_id: null, operator_id: null, operator_name: null }
          : data;
        await db.machine_status.put({ ...status, _cached_at: new Date().toISOString() });
        return status;
      }
    } catch {}
  }

  return db.machine_status.get(machineId) || null;
}

/** True if another operator holds the machine lock. */
export function isBlockedByOther(status, userId) {
  if (!status?.is_running) return false;
  if (!status.operator_id) return false;
  return status.operator_id !== userId;
}
