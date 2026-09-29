import { buildShiftActivityTimeline } from "./shiftMetrics.js";
import { SHIFT } from "./constants.js";
import { getShiftStatus } from "./utils.js";
import { ownerForStopReason } from "./stopReasons.js";

function dayBounds(ref = new Date()) {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return { start: start.getTime(), end: end.getTime() };
}

/** Build run/stop periods for one machine inside [fromMs, toMs], extending open run to `nowMs`. */
export function buildMachinePeriods({ machineId, shifts = [], events = [], fromMs, toMs, nowMs = Date.now() }) {
  const windowEnd = Math.min(toMs, nowMs);
  const machineShifts = (shifts || []).filter((s) => s.machine_id === machineId);
  const periods = [];

  for (const shift of machineShifts) {
    const shiftStart = new Date(shift.started_at || 0).getTime();
    const shiftEndRaw = shift.ended_at || shift.verified_at;
    const shiftStillOpen = getShiftStatus(shift) === SHIFT.RUNNING;
    const shiftEnd = shiftStillOpen
      ? windowEnd
      : Math.min(windowEnd, shiftEndRaw ? new Date(shiftEndRaw).getTime() : windowEnd);
    if (!Number.isFinite(shiftStart) || shiftEnd <= fromMs || shiftStart > windowEnd) continue;

    const timeline = buildShiftActivityTimeline(
      { ...shift, ended_at: shiftStillOpen ? new Date(windowEnd).toISOString() : shift.ended_at },
      events
    );
    for (const p of timeline.periods || []) {
      const start = Math.max(fromMs, p.start);
      const end = Math.min(windowEnd, p.end);
      if (end <= start) continue;
      periods.push({
        ...p,
        start,
        end,
        minutes: Math.max(0, Math.round((end - start) / 60000)),
        shiftId: shift.id,
        operatorName: shift.operator_name,
      });
    }

    // Running shift with no event timeline yet — treat as continuous run from start.
    if (shiftStillOpen && (!timeline.periods || !timeline.periods.length) && shiftStart < windowEnd) {
      const start = Math.max(fromMs, shiftStart);
      const end = windowEnd;
      if (end > start) {
        periods.push({
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

  periods.sort((a, b) => a.start - b.start);
  return mergeAdjacentPeriods(periods);
}

function mergeAdjacentPeriods(periods) {
  if (!periods.length) return [];
  const out = [{ ...periods[0] }];
  for (let i = 1; i < periods.length; i += 1) {
    const last = out[out.length - 1];
    const next = periods[i];
    if (last.state === next.state && Math.abs(next.start - last.end) < 2000) {
      last.end = Math.max(last.end, next.end);
      last.minutes = Math.max(0, Math.round((last.end - last.start) / 60000));
      if (!last.reason && next.reason) last.reason = next.reason;
    } else {
      out.push({ ...next });
    }
  }
  return out;
}

/** True-stock series: +minutes while running, −minutes while stopped. */
export function buildStockSeries(periods) {
  if (!periods.length) return { points: [], endScore: 0, runtimeMin: 0, downtimeMin: 0 };
  let score = 0;
  let runtimeMin = 0;
  let downtimeMin = 0;
  const points = [{ t: periods[0].start, score: 0, state: "start" }];
  for (const p of periods) {
    const mins = Math.max(0, (p.end - p.start) / 60000);
    if (p.state === "running") {
      score += mins;
      runtimeMin += mins;
    } else {
      score -= mins;
      downtimeMin += mins;
    }
    points.push({
      t: p.end,
      score,
      state: p.state,
      reason: p.reason,
      minutes: Math.round(mins),
      operatorName: p.operatorName,
    });
  }
  return {
    points,
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
