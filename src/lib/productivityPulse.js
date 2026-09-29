import { buildShiftActivityTimeline } from "./shiftMetrics.js";
import { SHIFT } from "./constants.js";
import { dedupeShifts, getShiftStatus } from "./utils.js";
import { ownerForStopReason } from "./stopReasons.js";

function dayBounds(ref = new Date()) {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return { start: start.getTime(), end: end.getTime() };
}

/**
 * Build non-overlapping run/stop periods for one machine inside [fromMs, toMs].
 * Overlapping shifts/events are flattened so the stock line never goes backward in time.
 */
export function buildMachinePeriods({ machineId, shifts = [], events = [], fromMs, toMs, nowMs = Date.now() }) {
  const windowEnd = Math.min(toMs, nowMs);
  const machineShifts = dedupeShifts((shifts || []).filter((s) => s.machine_id === machineId));
  const raw = [];

  for (const shift of machineShifts) {
    const shiftStart = new Date(shift.started_at || 0).getTime();
    const shiftEndRaw = shift.ended_at || shift.verified_at;
    const shiftStillOpen = getShiftStatus(shift) === SHIFT.RUNNING;
    const shiftEnd = shiftStillOpen
      ? windowEnd
      : Math.min(windowEnd, shiftEndRaw ? new Date(shiftEndRaw).getTime() : windowEnd);
    if (!Number.isFinite(shiftStart) || shiftEnd <= fromMs || shiftStart > windowEnd) continue;

    const timeline = buildShiftActivityTimeline(
      { ...shift, ended_at: shiftStillOpen ? new Date(windowEnd).toISOString() : (shift.ended_at || shift.verified_at) },
      events
    );

    let added = 0;
    for (const p of timeline.periods || []) {
      const start = Math.max(fromMs, p.start);
      const end = Math.min(windowEnd, p.end);
      if (end <= start) continue;
      raw.push({
        ...p,
        start,
        end,
        minutes: Math.max(0, Math.round((end - start) / 60000)),
        shiftId: shift.id,
        operatorName: shift.operator_name,
      });
      added += 1;
    }

    // Running shift with no event timeline yet — continuous run from start (or window).
    if (!added && shiftStillOpen && shiftStart < windowEnd) {
      const start = Math.max(fromMs, shiftStart);
      const end = windowEnd;
      if (end > start) {
        raw.push({
          state: "running",
          start,
          end,
          minutes: Math.max(0, Math.round((end - start) / 60000)),
          shiftId: shift.id,
          operatorName: shift.operator_name,
        });
      }
    } else if (!added && !shiftStillOpen && shiftStart < windowEnd) {
      // Closed shift with no MACHINE_STARTED events — treat whole shift as running.
      const start = Math.max(fromMs, shiftStart);
      const end = Math.min(windowEnd, shiftEnd);
      if (end > start) {
        raw.push({
          state: "running",
          start,
          end,
          minutes: Math.max(0, Math.round((end - start) / 60000)),
          shiftId: shift.id,
          operatorName: shift.operator_name,
        });
      }
    }
  }

  return flattenToSingleTimeline(raw, fromMs, windowEnd);
}

/** Cut overlapping periods into one chronological run/stop line (stop wins ties). */
function flattenToSingleTimeline(periods, fromMs, toMs) {
  if (!periods.length) return [];
  const cuts = new Set([fromMs, toMs]);
  for (const p of periods) {
    if (p.start > fromMs && p.start < toMs) cuts.add(p.start);
    if (p.end > fromMs && p.end < toMs) cuts.add(p.end);
  }
  const times = [...cuts].sort((a, b) => a - b);
  const slices = [];

  for (let i = 0; i < times.length - 1; i += 1) {
    const start = times[i];
    const end = times[i + 1];
    if (end <= start) continue;
    const mid = (start + end) / 2;
    const covering = periods.filter((p) => p.start <= mid && p.end > mid);
    if (!covering.length) continue;
    const stopped = covering.find((p) => p.state === "stopped");
    const chosen = stopped || covering.find((p) => p.state === "running") || covering[0];
    const slice = {
      state: chosen.state,
      start,
      end,
      reason: chosen.reason,
      note: chosen.note,
      shiftId: chosen.shiftId,
      operatorName: chosen.operatorName,
      minutes: Math.max(0, Math.round((end - start) / 60000)),
    };
    const last = slices[slices.length - 1];
    if (last && last.state === slice.state && Math.abs(slice.start - last.end) < 2) {
      last.end = slice.end;
      last.minutes = Math.max(0, Math.round((last.end - last.start) / 60000));
      if (!last.reason && slice.reason) last.reason = slice.reason;
      if (!last.operatorName && slice.operatorName) last.operatorName = slice.operatorName;
    } else {
      slices.push(slice);
    }
  }
  return slices;
}

/**
 * True-stock series: +minutes while running, −minutes while stopped.
 * Points are always increasing in time — flat across idle gaps.
 */
export function buildStockSeries(periods) {
  if (!periods.length) return { points: [], endScore: 0, runtimeMin: 0, downtimeMin: 0 };
  const ordered = [...periods].sort((a, b) => a.start - b.start || a.end - b.end);
  let score = 0;
  let runtimeMin = 0;
  let downtimeMin = 0;
  let lastT = ordered[0].start;
  const points = [{ t: lastT, score: 0, state: "start" }];

  for (const p of ordered) {
    const startT = Math.max(p.start, lastT);
    const endT = Math.max(p.end, startT);
    // Hold score flat across any gap before this period.
    if (startT > lastT) {
      points.push({ t: startT, score, state: "gap" });
      lastT = startT;
    }
    const mins = Math.max(0, (endT - startT) / 60000);
    if (mins <= 0) continue;
    if (p.state === "running") {
      score += mins;
      runtimeMin += mins;
    } else if (p.state === "stopped") {
      score -= mins;
      downtimeMin += mins;
    }
    points.push({
      t: endT,
      score,
      state: p.state,
      reason: p.reason,
      minutes: Math.round(mins),
      operatorName: p.operatorName,
    });
    lastT = endT;
  }

  // Drop near-duplicate timestamps that can jitter the path.
  const cleaned = [];
  for (const pt of points) {
    const prev = cleaned[cleaned.length - 1];
    if (prev && Math.abs(pt.t - prev.t) < 500 && Math.abs(pt.score - prev.score) < 0.01) {
      cleaned[cleaned.length - 1] = { ...prev, ...pt, t: Math.max(prev.t, pt.t) };
      continue;
    }
    if (prev && pt.t < prev.t) continue; // never go backward
    cleaned.push(pt);
  }

  return {
    points: cleaned,
    endScore: score,
    runtimeMin: Math.round(runtimeMin),
    downtimeMin: Math.round(downtimeMin),
  };
}

export function buildOwnerTotals(periods, siteSettings) {
  const totals = {};
  for (const p of periods) {
    if (p.state !== "stopped") continue;
    const owner = ownerForStopReason(p.reason, siteSettings);
    totals[owner] = (totals[owner] || 0) + Number(p.minutes || 0);
  }
  return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

export function buildPulseSnapshot({
  machineId,
  shifts,
  events,
  siteSettings,
  window = "today",
  dayRef = null,
  cycleStart,
  cycleEnd,
  nowMs = Date.now(),
}) {
  let fromMs;
  let toMs;
  let live = false;
  if (window === "cycle" && cycleStart && cycleEnd) {
    fromMs = new Date(cycleStart).getTime();
    toMs = new Date(cycleEnd).getTime();
    live = nowMs >= fromMs && nowMs <= toMs;
  } else if (window === "day" && dayRef) {
    const b = dayBounds(new Date(dayRef));
    fromMs = b.start;
    toMs = b.end;
    live = nowMs >= fromMs && nowMs <= toMs;
  } else {
    const b = dayBounds(new Date(nowMs));
    fromMs = b.start;
    toMs = b.end;
    live = true;
  }
  const periods = buildMachinePeriods({ machineId, shifts, events, fromMs, toMs, nowMs });
  const series = buildStockSeries(periods);
  const openStop = live
    ? [...periods].reverse().find((p) => p.state === "stopped" && p.end >= nowMs - 2000)
    : null;
  const runningNow = live
    ? periods.some((p) => p.state === "running" && p.start <= nowMs && p.end >= nowMs - 2000)
    : false;
  const latestStop = [...periods].reverse().find((p) => p.state === "stopped");
  return {
    fromMs,
    toMs,
    live,
    periods,
    ...series,
    ownerTotals: buildOwnerTotals(periods, siteSettings),
    runningNow,
    openStop: openStop || null,
    latestStop: latestStop || null,
    currentOwner: openStop ? ownerForStopReason(openStop.reason, siteSettings) : null,
  };
}

export { dayBounds };
