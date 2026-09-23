import Dexie from "dexie";
import { SYNC_TABLES } from "./constants.js";

/** @type {Dexie | null} */
let db = null;

const TABLE_INDEXES = {
  sites: "id, code, active",
  machines: "id, site_id, code, active",
  profiles: "id, email, role, site_id, machine_id",
  shifts: "id, site_id, machine_id, operator_id, shift_status, started_at, ended_at, updated_at",
  events: "id, site_id, shift_id, machine_id, type, timestamp, status, updated_at",
  expenses: "id, site_id, machine_id, operator_id, date, category, updated_at",
  inspections: "id, site_id, machine_id, operator_id, timestamp, inspection_id, updated_at",
  issues: "id, site_id, machine_id, reporter_id, current_owner_id, current_owner_role, status, priority, created_at, updated_at",
  issue_messages: "id, issue_id, sender_id, type, created_at",
  work_sessions: "id, site_id, operator_id, machine_id, status, clock_in, updated_at",
  shift_submissions: "id, site_id, shift_id, status, updated_at",
  shift_corrections: "id, shift_id, submission_id",
  fuel_logs: "id, site_id, machine_id, operator_id, timestamp, shift_id, updated_at",
  machine_hour_readings: "id, site_id, machine_id, operator_id, reading_at, shift_id, updated_at",
  breakdowns: "id, site_id, machine_id, assigned_to, status, priority, created_at, updated_at",
  maintenance_jobs: "id, site_id, machine_id, breakdown_id, mechanic_id, status, updated_at",
  maintenance_parts: "id, maintenance_job_id, inventory_item_id",
  inventory_items: "id, site_id, sku, category, updated_at",
  inventory_movements: "id, site_id, inventory_item_id, maintenance_job_id, created_at",
  site_settings: "id, site_id, updated_at",
  sync_queue: "++queue_id, table, record_id, status, created_at",
  sync_meta: "key",
  media_blobs: "id, status, created_at",
  machine_locks: "machine_id, status, synced",
  machine_status: "machine_id, is_running, operator_id",
};

const V1_STORES = Object.fromEntries(
  Object.entries(TABLE_INDEXES).filter(([k]) => k !== "machine_status")
);

export async function initDB() {
  if (db?.isOpen?.()) return db;

  db = new Dexie("OPS_MineOps");
  db.version(1).stores(V1_STORES);
  db.version(2).stores(TABLE_INDEXES);
  db.version(3).stores(TABLE_INDEXES);
  db.version(4).stores(TABLE_INDEXES);

  await db.open();
  return db;
}

export function getDB() {
  return db;
}

export async function ensureDB() {
  if (!db || !db.isOpen()) return initDB();
  return db;
}

/** Read all rows from a local table */
export async function readTable(table) {
  const database = await ensureDB();
  if (!database[table]) return [];
  return database[table].toArray();
}

/** Save record locally and enqueue for sync */
export async function saveLocal(table, record, { enqueue = true } = {}) {
  const database = await ensureDB();
  const row = {
    ...record,
    _sync_status: record._sync_status || "pending",
    _local_updated_at: record._local_updated_at || new Date().toISOString(),
  };
  await database[table].put(row);
  if (enqueue) await enqueueSync(table, record.id);
  return row;
}

export async function saveManyLocal(table, records) {
  const database = await ensureDB();
  const rows = records.map((r) => ({
    ...r,
    _sync_status: r._sync_status || "pending",
    _local_updated_at: r._local_updated_at || new Date().toISOString(),
  }));
  await database[table].bulkPut(rows);
  for (const r of rows) await enqueueSync(table, r.id);
  return rows;
}

export async function enqueueSync(table, recordId) {
  const database = await ensureDB();
  const existing = await database.sync_queue
    .where({ table, record_id: recordId })
    .filter((q) => q.status === "pending" || q.status === "syncing")
    .first();
  if (existing) return existing.queue_id;
  return database.sync_queue.add({
    table,
    record_id: recordId,
    status: "pending",
    attempts: 0,
    created_at: new Date().toISOString(),
  });
}

export async function getPendingCount() {
  const database = await ensureDB();
  return database.sync_queue.where("status").anyOf("pending", "syncing", "failed").count();
}

/** Last push errors for queue rows that did not clear (shown when retry did nothing) */
export async function getStuckQueueErrors(limit = 8) {
  const database = await ensureDB();
  const rows = await database.sync_queue
    .where("status")
    .anyOf("pending", "failed", "syncing")
    .toArray();
  return rows
    .filter((q) => q.last_error)
    .sort((a, b) => new Date(b.last_attempt || b.created_at || 0) - new Date(a.last_attempt || a.created_at || 0))
    .slice(0, limit)
    .map((q) => `${q.table}/${q.record_id}: ${q.last_error}`);
}

export async function getSyncMeta(key) {
  const database = await ensureDB();
  const row = await database.sync_meta.get(key);
  return row?.value ?? null;
}

export async function setSyncMeta(key, value) {
  const database = await ensureDB();
  await database.sync_meta.put({ key, value });
}

/** Merge server row — never overwrite pending local changes */
export async function mergeServerRow(table, serverRow) {
  const database = await ensureDB();
  const pending = await database.sync_queue
    .where({ table, record_id: serverRow.id })
    .filter((q) => q.status === "pending" || q.status === "syncing")
    .first();

  if (pending) return false;

  const local = await database[table].get(serverRow.id);
  if (local?._sync_status === "pending") return false;

  const serverUpdated = serverRow.updated_at || serverRow.created_at;
  const localUpdated = local?._server_updated_at || local?.updated_at;

  if (local && localUpdated && serverUpdated && new Date(localUpdated) > new Date(serverUpdated)) {
    return false;
  }

  await database[table].put({
    ...serverRow,
    _sync_status: "synced",
    _server_updated_at: serverUpdated,
  });
  return true;
}

export async function clearSyncedTables({ keepPending = true } = {}) {
  const database = await ensureDB();
  if (!keepPending) {
    for (const t of SYNC_TABLES) {
      if (database[t]) await database[t].clear();
    }
    return;
  }
  const pendingKeys = new Set(
    (await database.sync_queue.toArray()).map((q) => `${q.table}:${q.record_id}`)
  );
  for (const t of SYNC_TABLES) {
    if (!database[t]) continue;
    const all = await database[t].toArray();
    const toDelete = all.filter((r) => !pendingKeys.has(`${t}:${r.id}`)).map((r) => r.id);
    if (toDelete.length) await database[t].bulkDelete(toDelete);
  }
}
