import { getDB } from "./db.js";
import { supabase } from "./supabase.js";
import { SHIFT } from "./constants.js";
import { findOpenStopForShift } from "./shiftMetrics.js";
import { fetchMachineStatus, isBlockedByOther } from "./machineStatus.js";

/**
 * Offline-first machine lock.
 * Local lock is applied immediately; RPC reconciles when online.
 */
export async function acquireMachineLock(machineId, shiftId, operatorId) {
  const db = getDB();

  const remoteStatus = await fetchMachineStatus(machineId);
  if (isBlockedByOther(remoteStatus, operatorId)) {
    return {
      accepted: false,
      reason: `${remoteStatus.operator_name || "Another operator"} is already running this machine`,
      operatorName: remoteStatus.operator_name,
    };
  }

  const existing = await db.machine_locks.get(machineId);
  if (existing?.status === "locked" && existing.operator_id !== operatorId && existing.shift_id !== shiftId) {
    return { accepted: false, reason: "Machine running on another device" };
  }

  const lock = {
    machine_id: machineId,
    shift_id: shiftId,
    operator_id: operatorId,
    status: "locked",
    locked_at: new Date().toISOString(),
    synced: false,
  };

  await db.machine_locks.put(lock);

  if (navigator.onLine) {
    try {
      const { data, error } = await supabase.rpc("start_machine", {
        p_machine_id: machineId,
        p_shift_id: shiftId,
      });
      if (error) throw error;
      if (data === false) {
        await db.machine_locks.delete(machineId);
        return { accepted: false, reason: "Machine already running on server" };
      }
      await db.machine_locks.update(machineId, { synced: true });
    } catch (e) {
      // Keep local lock — will retry on sync
      return { accepted: true, pendingSync: true, warning: e.message };
    }
  }

  return { accepted: true, pendingSync: !navigator.onLine };
}

export async function releaseMachineLock(machineId) {
  const db = getDB();
  await db.machine_locks.delete(machineId);

  if (navigator.onLine) {
    try {
      await supabase.rpc("stop_machine", { p_machine_id: machineId });
    } catch (e) {
      return { released: true, pendingSync: true, warning: e.message };
    }
  }

  return { released: true, pendingSync: !navigator.onLine };
}

/** Retry pending lock RPCs during sync — skip stale locks that would fight stop state */
export async function syncMachineLocks() {
  if (!navigator.onLine) return;
  const db = getDB();
  const locks = await db.machine_locks.filter((l) => l.synced !== true).toArray();
  for (const lock of locks) {
    try {
      const shift = lock.shift_id ? await db.shifts.get(lock.shift_id) : null;
      if (!shift || shift.shift_status !== SHIFT.RUNNING) {
        await db.machine_locks.delete(lock.machine_id);
        continue;
      }

      const events = await db.events.where("shift_id").equals(lock.shift_id).toArray();
      if (findOpenStopForShift(events, lock.shift_id)) {
        await db.machine_locks.delete(lock.machine_id);
        continue;
      }

      const { data, error } = await supabase.rpc("start_machine", {
        p_machine_id: lock.machine_id,
        p_shift_id: lock.shift_id,
      });
      if (!error && data !== false) {
        await db.machine_locks.update(lock.machine_id, { synced: true });
      } else if (data === false) {
        await db.machine_locks.delete(lock.machine_id);
      }
    } catch {}
  }
}
