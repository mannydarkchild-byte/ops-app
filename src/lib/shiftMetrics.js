/** Billable machine hours — always from hour meter readings, never from app timer */
export function meterHoursWorked(startMeter, endMeter) {
  const start = Number(startMeter);
  const end = Number(endMeter);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, end - start);
}

/** Sum closed stop events for a shift (app-tracked downtime) */
export function shiftDowntimeMinutes(events, shiftId) {
  if (!shiftId) return 0;
  return events
    .filter((e) => e.shift_id === shiftId && e.type === "STOP" && e.status === "closed")
    .reduce((sum, e) => sum + Number(e.downtime_minutes || 0), 0);
}

/** App runtime = elapsed shift time minus downtime (not meter hours) */
export function shiftRuntimeMinutes(startedAt, endedAt, downtimeMinutes) {
  if (!startedAt || !endedAt) return 0;
  const elapsed = Math.max(0, (new Date(endedAt) - new Date(startedAt)) / 60000);
  return Math.max(0, elapsed - Number(downtimeMinutes || 0));
}

export function formatDurationMinutes(totalMinutes) {
  const m = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

export function formatDurationSeconds(totalSeconds) {
  return formatDurationMinutes(totalSeconds / 60);
}

/** Event sort/display timestamp */
export function eventTimestampMs(e) {
  return new Date(e?.timestamp || e?.stopped_at || e?.created_at || 0).getTime();
}

export function dedupeEventsById(events) {
  const map = new Map();
  for (const e of events || []) {
    if (e?.id) map.set(e.id, e);
  }
  return [...map.values()];
}

/** Open downtime row for a shift, if any */
export function findOpenStopForShift(events, shiftId) {
  if (!shiftId) return null;
  return (events || []).find((e) => e.shift_id === shiftId && e.type === "STOP" && e.status === "open") || null;
}

const NOISE_WINDOW_MS = 30000;

function mergeStopEvents(a, b) {
  const stoppedAt = [a.stopped_at, b.stopped_at].filter(Boolean).sort()[0];
  const restartedAt = [a.restarted_at, b.restarted_at].filter(Boolean).sort().pop() || null;
  const preferClosed = a.status === "closed" ? a : b.status === "closed" ? b : a;
  let minutes = Math.max(Number(a.downtime_minutes || 0), Number(b.downtime_minutes || 0));
  if (!minutes && stoppedAt && restartedAt) {
    minutes = Math.max(0, Math.round((new Date(restartedAt) - new Date(stoppedAt)) / 60000));
  }
  return {
    ...preferClosed,
    stopped_at: stoppedAt,
    restarted_at: restartedAt,
    downtime_minutes: minutes || preferClosed.downtime_minutes,
    note: [...new Set([a.note, b.note].filter(Boolean))].join(" | ") || preferClosed.note || "",
    status: a.status === "closed" || b.status === "closed" ? "closed" : a.status,
  };
}

/** Collapse duplicate stop/start logs that fire every few seconds during sync */
export function collapseNoisyShiftEvents(events) {
  const sorted = dedupeEventsById(events).sort((a, b) => eventTimestampMs(a) - eventTimestampMs(b));
  const result = [];

  for (const e of sorted) {
    const last = result[result.length - 1];
    if (!last) {
      result.push(e);
      continue;
    }

    const dt = eventTimestampMs(e) - eventTimestampMs(last);
    if (e.type === last.type && dt < NOISE_WINDOW_MS) {
      if (e.type === "STOP") result[result.length - 1] = mergeStopEvents(last, e);
      continue;
    }

    const isFlipFlop =
      dt < NOISE_WINDOW_MS &&
      ((last.type === "STOP" && e.type === "MACHINE_STARTED") ||
        (last.type === "MACHINE_STARTED" && e.type === "STOP"));

    if (isFlipFlop) {
      const stopEv = last.type === "STOP" ? last : e;
      const restartAt = stopEv.restarted_at || (last.type === "MACHINE_STARTED" ? last.timestamp : e.timestamp);
      const minutes = stopDurationMinutes(stopEv, restartAt);
      if (minutes < 1) {
        if (last.type === "STOP") result.pop();
        continue;
      }
      if (last.type === "STOP" && e.type === "MACHINE_STARTED") {
        result[result.length - 1] = mergeStopEvents(last, {
          ...stopEv,
          restarted_at: e.timestamp,
          status: "closed",
          downtime_minutes: minutes,
        });
        continue;
      }
    }

    result.push(e);
  }

  return result;
}

/** Minutes a stop lasted — uses stored downtime or timestamps */
export function stopDurationMinutes(stop, shiftEndAt) {
  if (stop?.downtime_minutes != null && stop.status === "closed") {
    return Number(stop.downtime_minutes);
  }
  const start = stop?.stopped_at || stop?.timestamp;
  const end = stop?.restarted_at || (stop?.status === "closed" ? stop?.updated_at : shiftEndAt);
  if (!start || !end) return 0;
  return Math.max(0, Math.round((new Date(end) - new Date(start)) / 60000));
}

/** Deduplicated stop rows for downtime tables */
export function consolidateShiftStops(events, shift) {
  const shiftEnd = shift?.ended_at || shift?.verified_at;
  return collapseNoisyShiftEvents((events || []).filter((e) => e.shift_id === shift?.id && e.type === "STOP"))
    .map((stop) => ({
      ...stop,
      downtime_minutes: stopDurationMinutes(stop, shiftEnd),
    }))
    .filter((stop) => stop.downtime_minutes >= 1);
}

const MILESTONE_TYPES = new Set(["CLOCK_IN", "CLOCK_OUT", "METER_END_CAPTURED", "MACHINE_ENDED"]);

const MILESTONE_LABELS = {
  CLOCK_IN: "Clocked in",
  CLOCK_OUT: "Clocked out",
  METER_END_CAPTURED: "Closing meter photo",
  MACHINE_ENDED: "Day submitted",
};

function compressMicroPeriods(periods, minMs = NOISE_WINDOW_MS) {
  if (periods.length <= 1) return periods;

  let merged = [...periods];
  let changed = true;
  while (changed && merged.length > 1) {
    changed = false;
    const next = [];
    for (let i = 0; i < merged.length; i++) {
      const p = merged[i];
      const dur = p.end - p.start;
      if (dur < minMs) {
        changed = true;
        if (next.length) {
          next[next.length - 1].end = p.end;
          if (p.state === "stopped" && !next[next.length - 1].reason) {
            next[next.length - 1].reason = p.reason;
            next[next.length - 1].note = p.note;
          }
        } else if (i + 1 < merged.length) {
          merged[i + 1].start = p.start;
        } else {
          next.push(p);
        }
      } else {
        next.push(p);
      }
    }
    merged = next;
  }
  return merged;
}

/** Build running/stopped periods plus key milestones for shift reports */
export function buildShiftActivityTimeline(shift, events) {
  const shiftEnd = shift?.ended_at || shift?.verified_at;
  const shiftEndMs = shiftEnd ? new Date(shiftEnd).getTime() : null;
  const filtered = collapseNoisyShiftEvents((events || []).filter((e) => e.shift_id === shift?.id));
  const milestones = [];
  let machineStarted = false;

  const boundaries = [];
  for (const e of filtered.sort((a, b) => eventTimestampMs(a) - eventTimestampMs(b))) {
    if (MILESTONE_TYPES.has(e.type)) {
      milestones.push({
        at: e.timestamp || e.stopped_at,
        label: MILESTONE_LABELS[e.type] || e.type.replace(/_/g, " "),
        detail: e.note || "",
      });
      continue;
    }

    if (e.type === "MACHINE_STARTED") {
      if (!machineStarted) {
        milestones.push({ at: e.timestamp, label: "Machine started", detail: e.note || "" });
        machineStarted = true;
      }
      boundaries.push({ t: eventTimestampMs(e), state: "running" });
      continue;
    }

    if (e.type === "STOP") {
      const stopAt = eventTimestampMs(e);
      boundaries.push({ t: stopAt, state: "stopped", reason: e.reason, note: e.note });
      if (e.restarted_at) {
        boundaries.push({ t: new Date(e.restarted_at).getTime(), state: "running" });
      } else if (e.status === "closed" && e.updated_at) {
        boundaries.push({ t: new Date(e.updated_at).getTime(), state: "running" });
      }
    }
  }

  if (!boundaries.length) {
    return { milestones, periods: [] };
  }

  boundaries.sort((a, b) => a.t - b.t);
  const deduped = [];
  for (const b of boundaries) {
    const last = deduped[deduped.length - 1];
    if (last && last.state === b.state && b.t - last.t < NOISE_WINDOW_MS) continue;
    deduped.push(b);
  }

  let periods = [];
  for (let i = 0; i < deduped.length; i++) {
    const start = deduped[i].t;
    const end = deduped[i + 1]?.t ?? shiftEndMs;
    if (!end || end <= start) continue;
    periods.push({
      state: deduped[i].state,
      start,
      end,
      reason: deduped[i].reason,
      note: deduped[i].note,
    });
  }

  periods = compressMicroPeriods(periods);

  return {
    milestones,
    periods: periods.map((p) => ({
      ...p,
      minutes: Math.max(0, Math.round((p.end - p.start) / 60000)),
    })),
  };
}
