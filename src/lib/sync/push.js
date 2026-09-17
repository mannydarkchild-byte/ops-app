import { getDB } from "../db.js";
import { supabase } from "../supabase.js";
import { ALLOWED_COLUMNS } from "../constants.js";
import { resolveMediaRefsInRecord } from "../media.js";
import { uploadPendingMedia } from "../media.js";
import { BOOTSTRAP_MACHINE_ID, BOOTSTRAP_SITE_ID } from "../seed.js";

const CATALOG_TABLES = new Set(["sites", "machines", "inventory_items"]);
const CATALOG_WRITE_ROLES = new Set(["admin", "manager"]);
const BOOTSTRAP_IDS = {
  sites: new Set([BOOTSTRAP_SITE_ID]),
  machines: new Set([BOOTSTRAP_MACHINE_ID]),
};

async function shouldSkipCatalogPush(table, recordId) {
  if (!CATALOG_TABLES.has(table)) return false;
  if (BOOTSTRAP_IDS[table]?.has(recordId)) return true;

  const { data: { session } } = await supabase.auth.getSession();
  const profile = session?.user?.id ? await getDB().profiles.get(session.user.id) : null;
  return !CATALOG_WRITE_ROLES.has(profile?.role);
}

function buildPayload(table, row) {
  const allowed = ALLOWED_COLUMNS[table];
  const payload = {};
  if (allowed) {
    for (const k of allowed) {
      if (row[k] !== undefined) payload[k] = row[k];
    }
  } else {
    Object.assign(payload, row);
    delete payload._sync_status;
    delete payload._local_updated_at;
    delete payload._server_updated_at;
  }
  return payload;
}

export async function pushOneQueueItem(item) {
  const db = getDB();
  const row = await db[item.table].get(item.record_id);
  if (!row) {
    await db.sync_queue.delete(item.queue_id);
    return { ok: true, skipped: true };
  }

  await uploadPendingMedia();
  const resolved = await resolveMediaRefsInRecord(row);
  // Map new ref fields to legacy Supabase columns when needed
  if (resolved.photo_ref && !resolved.photo_data) resolved.photo_data = resolved.photo_ref;
  if (resolved.photo_pump_ref && !resolved.photo_pump) resolved.photo_pump = resolved.photo_pump_ref;
  if (resolved.photo_dipstick_ref && !resolved.photo_dipstick) resolved.photo_dipstick = resolved.photo_dipstick_ref;
  if (resolved.receipt_ref && !resolved.receipt_photo) resolved.receipt_photo = resolved.receipt_ref;
  if (resolved.photo_ref && !resolved.photo) resolved.photo = resolved.photo_ref;
  if (resolved.media_ref && !resolved.media_url) resolved.media_url = resolved.media_ref;
  if (resolved.supervisor_signature_ref && !resolved.supervisor_signature) resolved.supervisor_signature = resolved.supervisor_signature_ref;
  if (await shouldSkipCatalogPush(item.table, item.record_id)) {
    await db[item.table].update(item.record_id, { _sync_status: "synced" });
    await db.sync_queue.delete(item.queue_id);
    return { ok: true, skipped: true };
  }

  const payload = buildPayload(item.table, resolved);

  const { error } = await supabase.from(item.table).upsert(payload, { onConflict: "id" });
  if (error) throw error;

  await db[item.table].update(item.record_id, {
    _sync_status: "synced",
    _server_updated_at: payload.updated_at || payload.created_at || new Date().toISOString(),
  });
  await db.sync_queue.delete(item.queue_id);
  return { ok: true };
}

export async function pushPendingQueue({ maxItems = 50 } = {}) {
  const db = getDB();
  if (!navigator.onLine) return { pushed: 0, errors: ["offline"] };

  try {
    await db.sync_queue.where("status").equals("syncing").modify({ status: "pending" });
  } catch {}

  const now = Date.now();
  const queue = await db.sync_queue.where("status").equals("pending").toArray();
  const ready = queue
    .filter((item) => {
      if (!item.last_attempt) return true;
      const attempts = Number(item.attempts || 0);
      const delay = Math.min(15000 * Math.pow(2, Math.min(attempts - 1, 5)), 5 * 60 * 1000);
      return now - new Date(item.last_attempt).getTime() > delay;
    })
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(0, maxItems);

  let pushed = 0;
  const errors = [];

  for (const item of ready) {
    try {
      await db.sync_queue.update(item.queue_id, { status: "syncing" });
      await pushOneQueueItem(item);
      pushed++;
    } catch (e) {
      const nextAttempts = Number(item.attempts || 0) + 1;
      errors.push(`${item.table}/${item.record_id}: ${e.message}`);
      await db.sync_queue.update(item.queue_id, {
        status: nextAttempts >= 8 ? "failed" : "pending",
        attempts: nextAttempts,
        last_attempt: new Date().toISOString(),
        last_error: e.message,
      });
    }
  }

  return { pushed, errors };
}
