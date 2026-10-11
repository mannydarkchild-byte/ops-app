import { localDayKey } from "./utils.js";
import { tonnesPerBucket } from "./siteConfig.js";

export const DISPATCH_STATUS = {
  DRAFT: "draft",
  WAITING: "waiting",
  SIGNED: "signed",
};

export function dispatchStatus(row) {
  const status = String(row?.status || "").toLowerCase();
  if (status === DISPATCH_STATUS.SIGNED || row?.signed_at) return DISPATCH_STATUS.SIGNED;
  if (status === DISPATCH_STATUS.WAITING || row?.submitted_at) return DISPATCH_STATUS.WAITING;
  return DISPATCH_STATUS.DRAFT;
}

export function bucketTonnes(buckets, factor) {
  const count = Number(buckets);
  const each = Number(factor);
  if (!Number.isFinite(count) || count < 0 || !Number.isFinite(each) || each <= 0) return null;
  return Math.round(count * each * 100) / 100;
}

function roundTonnes(n) {
  return Math.round(Number(n) * 100) / 100;
}

function eachFor(row, key, fallback) {
  return tonnesPerBucket(row?.[key]) ?? tonnesPerBucket(fallback);
}

export function screenedTonnes(row, factors = {}) {
  const computed = bucketTonnes(row?.excavator_buckets, eachFor(row, "excavator_bucket_tonnes", factors.excavator_bucket_tonnes));
  if (computed != null) return computed;
  const stored = Number(row?.tonnes_screened);
  return row?.tonnes_screened == null || row?.tonnes_screened === "" || !Number.isFinite(stored) ? null : stored;
}

function sumKnown(values) {
  const known = values.filter((n) => n != null && Number.isFinite(n));
  if (!known.length) return null;
  return Math.round(known.reduce((sum, n) => sum + n, 0) * 100) / 100;
}

/** Closing stock: previous floor + FEL tonnes − weighbridge tonnes. */
export function runningFloor(rows, factors = {}) {
  const sorted = [...(rows || [])].sort((a, b) => dayKey(a.dispatch_date).localeCompare(dayKey(b.dispatch_date)));
  let opening = 0;
  return sorted.map((row) => {
    const felEach = eachFor(row, "fel_bucket_tonnes", factors.fel_bucket_tonnes);
    const added = bucketTonnes(row.fel_buckets, felEach);
    const removed = row.tonnes_dispatched == null || row.tonnes_dispatched === "" ? null : Number(row.tonnes_dispatched);
    const canClose = added != null && Number.isFinite(removed);
    const closing = canClose ? roundTonnes(opening + added - removed) : null;
    const next = {
      ...row,
      floor_opening: opening,
      floor_added: added,
      floor_removed: Number.isFinite(removed) ? removed : null,
      tonnes_on_floor: closing != null ? closing : row.tonnes_on_floor,
    };
    if (closing != null) opening = closing;
    return next;
  });
}

export function previewFloor(records, siteId, day, felTonnes, dispatchedTonnes, factors = {}) {
  const prior = runningFloor(
    (records || []).filter((row) => (!siteId || row.site_id === siteId) && dayKey(row.dispatch_date) < dayKey(day)),
    factors
  );
  const last = [...prior].reverse().find((row) => row.floor_added != null && row.floor_removed != null);
  const opening = last ? Number(last.tonnes_on_floor) || 0 : 0;
  const added = felTonnes == null || !Number.isFinite(Number(felTonnes)) ? null : Number(felTonnes);
  const removed = dispatchedTonnes == null || dispatchedTonnes === "" || !Number.isFinite(Number(dispatchedTonnes))
    ? null
    : Number(dispatchedTonnes);
  const closing = added != null && removed != null ? roundTonnes(opening + added - removed) : null;
  return { opening, added, removed, closing };
}

function dayKey(value) {
  return String(value || "").slice(0, 10);
}

function periodDayKey(date) {
  return localDayKey(date instanceof Date ? date : new Date(date));
}

export function dispatchInPeriod(row, period) {
  const key = dayKey(row?.dispatch_date);
  if (!key) return false;
  if (!period?.start || !period?.end) return true;
  return key >= periodDayKey(period.start) && key <= periodDayKey(period.end);
}

function tonnesLabel(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })} t`;
}

function sumField(rows, field) {
  return rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
}

function dayDetail(row) {
  const screened = row.tonnes_screened != null
    ? tonnesLabel(row.tonnes_screened)
    : "—";
  const floor = row.tonnes_on_floor != null ? tonnesLabel(row.tonnes_on_floor) : "—";
  return {
    id: row.id,
    title: dayKey(row.dispatch_date),
    detail: `${row.excavator_buckets ?? "—"} excavator buckets · ${row.fel_buckets ?? "—"} FEL buckets · ${dispatchStatus(row)}`,
    value: `${tonnesLabel(row.tonnes_dispatched)} · ${row.trucks_dispatched ?? "—"} trucks · screened ${screened} · floor ${floor}`,
  };
}

/** Site dispatch totals for a dashboard. Floor is the latest day, not a sum. */
export function summarizeDispatch(records, siteId, period, factors = {}) {
  const balanced = runningFloor((records || []).filter((row) => !siteId || row.site_id === siteId), factors);
  const rows = balanced
    .filter((row) => dispatchInPeriod(row, period))
    .sort((a, b) => dayKey(a.dispatch_date).localeCompare(dayKey(b.dispatch_date)));
  const today = localDayKey();
  const todayRow = rows.find((row) => dayKey(row.dispatch_date) === today)
    || (records || []).find((row) => (!siteId || row.site_id === siteId) && dayKey(row.dispatch_date) === today)
    || null;
  const latest = rows[rows.length - 1] || null;
  const weighbridge = sumField(rows, "tonnes_dispatched");
  const trucks = sumField(rows, "trucks_dispatched");
  const screened = sumKnown(rows.map((row) => screenedTonnes(row, factors)));
  const floor = latest?.tonnes_on_floor ?? null;

  const details = {
    weighbridge: {
      title: "Weighbridge tonnes",
      scope: period?.label || "This cycle",
      note: "Tonnes on the weighbridge report for each day. Today is shown separately and is included in the cycle when today is in the cycle.",
      total: tonnesLabel(weighbridge),
      rows: rows.map((row) => ({
        id: row.id,
        title: dayKey(row.dispatch_date),
        detail: dispatchStatus(row),
        value: tonnesLabel(row.tonnes_dispatched),
        emphasis: dayKey(row.dispatch_date) === today,
      })),
    },
    trucks: {
      title: "Trucks dispatched",
      scope: period?.label || "This cycle",
      note: "Truck count from the weighbridge report.",
      total: String(trucks),
      rows: rows.map((row) => ({
        id: row.id,
        title: dayKey(row.dispatch_date),
        detail: dispatchStatus(row),
        value: row.trucks_dispatched == null ? "—" : String(row.trucks_dispatched),
        emphasis: dayKey(row.dispatch_date) === today,
      })),
    },
    screened: {
      title: "Tonnes screened",
      scope: period?.label || "This cycle",
      note: "Excavator buckets × the tonnes per bucket saved on that day.",
      total: tonnesLabel(screened),
      rows: rows.map((row) => ({
        id: row.id,
        title: dayKey(row.dispatch_date),
        detail: `${row.excavator_buckets ?? "—"} buckets${eachFor(row, "excavator_bucket_tonnes", factors.excavator_bucket_tonnes) ? ` × ${eachFor(row, "excavator_bucket_tonnes", factors.excavator_bucket_tonnes)} t` : ""}`,
        value: tonnesLabel(screenedTonnes(row, factors)),
        emphasis: dayKey(row.dispatch_date) === today,
      })),
    },
    floor: {
      title: "Tonnes on the floor",
      scope: latest ? dayKey(latest.dispatch_date) : "No entry",
      note: "Closing stock for the latest day: the previous floor, plus FEL bucket tonnes, minus weighbridge tonnes dispatched. Days are not added together.",
      total: tonnesLabel(floor),
      rows: [...rows].reverse().map((row) => ({
        id: row.id,
        title: dayKey(row.dispatch_date),
        detail: `Opened ${tonnesLabel(row.floor_opening)} + ${tonnesLabel(row.floor_added)} FEL − ${tonnesLabel(row.floor_removed)} dispatched`,
        value: tonnesLabel(row.tonnes_on_floor),
        emphasis: row.id === latest?.id,
      })),
    },
  };

  return {
    rows,
    todayRow,
    latest,
    weighbridge,
    trucks,
    screened,
    floor,
    details,
    todayLabel: todayRow
      ? `${tonnesLabel(todayRow.tonnes_dispatched)} · ${todayRow.trucks_dispatched ?? "—"} trucks`
      : "Nothing entered today",
  };
}

export { tonnesLabel, dayDetail };
