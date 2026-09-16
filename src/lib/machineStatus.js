import { supabase } from "./supabase.js";
import { ensureDB } from "./db.js";

/** Fetch machine_status from server and cache locally (read-only). */
export async function fetchMachineStatus(machineId) {
  if (!machineId) return null;

  const db = await ensureDB();

  if (navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from("machine_status")
        .select("*")
        .eq("machine_id", machineId)
        .maybeSingle();
      if (!error && data) {
        await db.machine_status.put({ ...data, _cached_at: new Date().toISOString() });
        return data;
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
