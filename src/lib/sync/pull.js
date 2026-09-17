import { supabase } from "../supabase.js";
import { SYNC_TABLES } from "../constants.js";
import { getSyncMeta, setSyncMeta, mergeServerRow } from "../db.js";

const PAGE_SIZE = 500;

/** Tables with a site_id column — filter on the server when syncing one site */
const SITE_SCOPED_TABLES = new Set([
  "machines",
  "profiles",
  "shifts",
  "events",
  "expenses",
  "inspections",
  "issues",
  "work_sessions",
  "shift_submissions",
  "fuel_logs",
  "machine_hour_readings",
  "breakdowns",
  "maintenance_jobs",
  "inventory_items",
  "inventory_movements",
  "site_settings",
]);

const CREATED_AT_TABLES = new Set(["issue_messages", "shift_corrections", "maintenance_parts", "inventory_movements"]);

function applySiteFilter(query, table, siteId) {
  if (!siteId) return query;
  if (table === "sites") return query.eq("id", siteId);
  if (SITE_SCOPED_TABLES.has(table)) return query.eq("site_id", siteId);
  return query;
}

async function fetchIncremental(table, since, siteId = null) {
  const out = [];
  let from = 0;
  while (true) {
    let query = supabase.from(table).select("*").order("updated_at", { ascending: true });
    if (since) query = query.gt("updated_at", since);
    query = applySiteFilter(query, table, siteId);
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

/** Tables without updated_at use created_at watermark */
async function fetchIncrementalFallback(table, since, siteId = null) {
  const out = [];
  let from = 0;
  while (true) {
    let query = supabase.from(table).select("*").order("created_at", { ascending: true });
    if (since) query = query.gt("created_at", since);
    query = applySiteFilter(query, table, siteId);
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

export async function pullIncremental({ tables = SYNC_TABLES, siteId = null } = {}) {
  if (!navigator.onLine) return { pulled: 0, errors: ["offline"] };

  let totalPulled = 0;
  const errors = [];

  for (const table of tables) {
    try {
      const watermarkKey = `watermark_${table}${siteId ? `_${siteId}` : ""}`;
      const since = await getSyncMeta(watermarkKey);
      const rows = CREATED_AT_TABLES.has(table)
        ? await fetchIncrementalFallback(table, since, siteId)
        : await fetchIncremental(table, since, siteId);

      let merged = 0;
      let maxUpdated = since;

      for (const row of rows) {
        const didMerge = await mergeServerRow(table, row);
        if (didMerge) merged++;
        const ts = row.updated_at || row.created_at;
        if (ts && (!maxUpdated || new Date(ts) > new Date(maxUpdated))) maxUpdated = ts;
      }

      if (maxUpdated && maxUpdated !== since) {
        await setSyncMeta(watermarkKey, maxUpdated);
      }

      totalPulled += merged;
    } catch (e) {
      // Table may not exist yet in Supabase — skip gracefully
      if (!e.message?.includes("does not exist") && e.code !== "PGRST205") {
        errors.push(`${table}: ${e.message}`);
      }
    }
  }

  await setSyncMeta("last_pull_at", new Date().toISOString());
  return { pulled: totalPulled, errors };
}

/** Initial bootstrap: pull recent data only (last 90 days) */
export async function pullBootstrap({ siteId = null, daysBack = 90 } = {}) {
  if (!navigator.onLine) return { pulled: 0, errors: ["offline"] };

  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const sinceISO = since.toISOString();

  let totalPulled = 0;
  const errors = [];

  for (const table of SYNC_TABLES) {
    try {
      let query = supabase.from(table).select("*");
      if (!CREATED_AT_TABLES.has(table)) {
        query = query.or(`updated_at.gte.${sinceISO},created_at.gte.${sinceISO}`);
      } else {
        query = query.gte("created_at", sinceISO);
      }
      query = applySiteFilter(query, table, siteId);
      const { data, error } = await query.limit(5000);
      if (error) throw error;
      if (!data?.length) continue;

      for (const row of data) {
        if (await mergeServerRow(table, row)) totalPulled++;
      }
      const maxTs = data.reduce((max, r) => {
        const ts = r.updated_at || r.created_at;
        return ts && (!max || new Date(ts) > new Date(max)) ? ts : max;
      }, null);
      if (maxTs) await setSyncMeta(`watermark_${table}${siteId ? `_${siteId}` : ""}`, maxTs);
    } catch (e) {
      if (!e.message?.includes("does not exist") && e.code !== "PGRST205") {
        errors.push(`${table}: ${e.message}`);
      }
    }
  }

  await setSyncMeta("bootstrapped_at", new Date().toISOString());
  return { pulled: totalPulled, errors };
}
