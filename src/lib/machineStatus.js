import { supabase } from "./supabase.js";
import { dropLocalRecord, ensureDB, mergeServerRow } from "./db.js";
import { SHIFT } from "./constants.js";

function isLocalRunning(shift) {
  return shift?.shift_status === SHIFT.RUNNING || shift?.status === SHIFT.RUNNING;
}

export async function fetchServerOpenShift(machineId) {
  if (!navigator.onLine || !machineId) return { known: false, shift: null };
  const { data, error } = await supabase
    .from("shifts")
    .select("id, operator_id, operator_name, started_at, shift_status")
    .eq("machine_id", machineId)
    .eq("shift_status", SHIFT.RUNNING)
    .limit(1);
  if (error) return { known: false, shift: null };
  return { known: true, shift: data?.[0] || null };
}

/** All leftover RUNNING shifts on the server — Live tab uses this so close is visible. */
export async function fetchServerOpenShifts() {
  if (!navigator.onLine) return { known: false, shifts: [] };
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("shift_status", SHIFT.RUNNING)
    .order("started_at", { ascending: false });
  if (error) return { known: false, shifts: [] };
  return { known: true, shifts: data || [] };
}

export async function hydrateOpenShiftsFromServer() {
  const remote = await fetchServerOpenShifts();
  if (!remote.known) return remote;
  for (const shift of remote.shifts) {
    try { await mergeServerRow("shifts", shift); } catch {}
  }
  return remote;
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
