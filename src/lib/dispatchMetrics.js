import { localDayKey } from "./utils.js";

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
export function summarizeDispatch(records, siteId, period) {
  const rows = (records || [])
    .filter((row) => !siteId || row.site_id === siteId)
    .filter((row) => dispatchInPeriod(row, period))
    .sort((a, b) => dayKey(a.dispatch_date).localeCompare(dayKey(b.dispatch_date)));
  const today = localDayKey();
  const todayRow = rows.find((row) => dayKey(row.dispatch_date) === today)
    || (records || []).find((row) => (!siteId || row.site_id === siteId) && dayKey(row.dispatch_date) === today)
    || null;
  const latest = rows[rows.length - 1] || null;
  const weighbridge = sumField(rows, "tonnes_dispatched");
  const trucks = sumField(rows, "trucks_dispatched");
  const screened = sumField(rows, "tonnes_screened");
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
        detail: `${row.excavator_buckets ?? "—"} buckets${row.excavator_bucket_tonnes ? ` × ${row.excavator_bucket_tonnes} t` : ""}`,
        value: tonnesLabel(row.tonnes_screened),
        emphasis: dayKey(row.dispatch_date) === today,
      })),
    },
    floor: {
      title: "Tonnes on the floor",
      scope: latest ? dayKey(latest.dispatch_date) : "No entry",
      note: "FEL buckets × the tonnes per bucket for the latest day in this cycle. Days are not added together.",
      total: tonnesLabel(floor),
      rows: [...rows].reverse().map((row) => ({
        id: row.id,
        title: dayKey(row.dispatch_date),
        detail: `${row.fel_buckets ?? "—"} FEL buckets${row.fel_bucket_tonnes ? ` × ${row.fel_bucket_tonnes} t` : ""}`,
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
