import { SHIFT } from "./constants.js";
import { meterHoursWorked, shiftBillableHours, formatDurationMinutes } from "./shiftMetrics.js";
import { dedupeShifts, fmtDateShort, getShiftStatus, inPeriod, money, shiftBillableValue } from "./utils.js";

/** Shifts that started in the billing cycle, with duplicate open rows collapsed. */
export function shiftsStartedInPeriod(shifts, period) {
  return dedupeShifts((shifts || []).filter((shift) => inPeriod(shift.started_at, period)));
}

/** Hour-meter hours. Open shifts have no closing reading, so they are not part of the total. */
export function meterHoursOnShift(shift) {
  if (shift?.end_hour_meter == null || shift?.start_hour_meter == null) return null;
  const hours = meterHoursWorked(shift.start_hour_meter, shift.end_hour_meter);
  return Number.isFinite(hours) ? hours : null;
}

export function sumMeterHours(shifts) {
  return (shifts || []).reduce((sum, shift) => sum + (meterHoursOnShift(shift) || 0), 0);
}

function statusLabel(shift) {
  const status = getShiftStatus(shift);
  if (status === SHIFT.VERIFIED) return "Signed";
  if (status === SHIFT.RUNNING) return "Still open";
  if (status === SHIFT.WAITING_FOR_VERIFICATION || status === SHIFT.RESUBMITTED || status === SHIFT.SUBMITTED) return "Awaiting sign-off";
  if (status === SHIFT.CORRECTION_REQUIRED) return "Sent back";
  return "Recorded";
}

function shiftHeading(shift, machineName) {
  return `${machineName(shift.machine_id)} · ${fmtDateShort(shift.started_at)}`;
}

export function billableDetail(shifts, events, siteSettings, machineName) {
  const rows = (shifts || []).map((shift) => {
    const hours = shiftBillableHours(shift, events, siteSettings);
    return {
      id: shift.id,
      title: shiftHeading(shift, machineName),
      detail: `${shift.operator_name || "Operator"} · ${statusLabel(shift)}`,
      value: `${hours.toFixed(1)}h`,
      amount: hours,
    };
  });
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return {
    title: "Billable hours",
    note: "Each shift that started this cycle counts as 8 hours, minus downtime owned by Darkchild. Shifts that are not signed yet are included.",
    total: `${total.toFixed(1)}h`,
    rows,
  };
}

export function machineHourDetail(shifts, machineName) {
  const finished = (shifts || []).filter((shift) => meterHoursOnShift(shift) != null);
  const byMachine = new Map();
  for (const shift of finished) {
    const hours = meterHoursOnShift(shift);
    const key = shift.machine_id || "machine";
    if (!byMachine.has(key)) {
      byMachine.set(key, { name: machineName(shift.machine_id), hours: 0, rows: [] });
    }
    const bucket = byMachine.get(key);
    bucket.hours += hours;
    bucket.rows.push({
      id: shift.id,
      title: `${fmtDateShort(shift.started_at)} · ${shift.operator_name || "Operator"}`,
      detail: `Meter ${shift.start_hour_meter}h → ${shift.end_hour_meter}h · ${statusLabel(shift)}`,
      value: `${hours.toFixed(1)}h`,
    });
  }
  const rows = [];
  for (const bucket of byMachine.values()) {
    if (byMachine.size > 1) {
      rows.push({
        id: `machine-${bucket.name}`,
        title: bucket.name,
        detail: "This machine",
        value: `${bucket.hours.toFixed(1)}h`,
        emphasis: true,
      });
    }
    rows.push(...bucket.rows);
  }
  const total = [...byMachine.values()].reduce((sum, bucket) => sum + bucket.hours, 0);
  return {
    title: "Machine hours",
    note: "Closing hour meter minus opening hour meter. Shifts that are still open are not in this total.",
    total: `${total.toFixed(1)}h`,
    rows,
    count: finished.length,
  };
}

export function revenueDetail(shifts, machines, events, siteSettings, machineName) {
  const rows = (shifts || []).map((shift) => {
    const value = shiftBillableValue(shift, machines, events, siteSettings);
    const machine = machines.find((item) => item.id === shift.machine_id);
    const rate = Number(machine?.billable_rate || 0);
    return {
      id: shift.id,
      title: shiftHeading(shift, machineName),
      detail: `${shiftBillableHours(shift, events, siteSettings).toFixed(1)}h × ${money(rate)}/h · ${statusLabel(shift)}`,
      value: money(value),
      amount: value,
    };
  });
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return {
    title: "Revenue",
    note: "Billable hours times the rate on that machine.",
    total: money(total),
    rows,
  };
}

export function expenseDetail(expenses, machineName) {
  const rows = [...(expenses || [])]
    .sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0))
    .map((expense) => ({
      id: expense.id,
      title: expense.description || expense.vendor || expense.category || "Payment",
      detail: `${machineName(expense.machine_id)} · ${expense.category || "Other"} · ${fmtDateShort(expense.date || expense.created_at)}`,
      value: money(expense.amount),
      amount: Number(expense.amount || 0),
    }));
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return {
    title: "Expenses",
    note: "Payments dated in this cycle.",
    total: money(total),
    rows,
  };
}

export function dieselDetail(fuelLogs, machineName) {
  const rows = [...(fuelLogs || [])]
    .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
    .map((log) => ({
      id: log.id,
      title: `${machineName(log.machine_id)} · ${fmtDateShort(log.timestamp)}`,
      detail: log.operator_name || "Fuel log",
      value: `${Number(log.litres || 0).toFixed(1)} L`,
      amount: Number(log.litres || 0),
    }));
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return {
    title: "Diesel",
    note: "Fuel logged in this cycle.",
    total: `${total.toFixed(1)} L`,
    rows,
  };
}

export function downtimeDetail(shifts, machineName) {
  const rows = (shifts || [])
    .filter((shift) => Number(shift.downtime_minutes || 0) > 0)
    .map((shift) => ({
      id: shift.id,
      title: shiftHeading(shift, machineName),
      detail: `${shift.operator_name || "Operator"} · ${statusLabel(shift)}`,
      value: formatDurationMinutes(shift.downtime_minutes || 0),
      amount: Number(shift.downtime_minutes || 0),
    }));
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return {
    title: "Downtime",
    note: "Stopped time stored on shifts that started this cycle.",
    total: formatDurationMinutes(total),
    rows,
  };
}
