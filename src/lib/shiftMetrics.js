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
