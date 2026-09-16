import { ISSUE, MAINTENANCE_STATUS, ROLES, SHIFT } from "./constants.js";
import { getBillingPeriod, inPeriod, money, shiftBillableValue } from "./utils.js";
import { formatDurationMinutes } from "./shiftMetrics.js";

export function computeAdminDashboard({
  profiles = [],
  machines = [],
  shifts = [],
  events = [],
  issues = [],
  expenses = [],
  fuelLogs = [],
  inspections = [],
  maintenanceJobs = [],
  breakdowns = [],
  workSessions = [],
  syncState = {},
}, period = getBillingPeriod()) {
  const activeProfiles = profiles.filter((p) => p.active !== false);
  const byRole = (role) => activeProfiles.filter((p) => p.role === role);

  const verifiedShifts = shifts.filter(
    (s) => s.shift_status === SHIFT.VERIFIED && inPeriod(s.verified_at || s.ended_at, period)
  );
  const pendingVerify = shifts.filter(
    (s) => [SHIFT.WAITING_FOR_VERIFICATION, SHIFT.RESUBMITTED, SHIFT.SUBMITTED].includes(s.shift_status)
  );
  const runningShifts = shifts.filter((s) => s.shift_status === SHIFT.RUNNING);
  const openStops = events.filter((e) => e.type === "STOP" && e.status === "open");

  const openIssues = issues.filter((i) => i.status !== ISSUE.RESOLVED);
  const criticalIssues = openIssues.filter((i) => i.priority === "Critical");
  const waitingParts = openIssues.filter((i) => i.status === ISSUE.WAITING_FOR_PARTS);

  const periodExpenses = expenses.filter((e) => inPeriod(e.date, period));
  const periodFuel = fuelLogs.filter((f) => inPeriod(f.timestamp, period));

  const billableHours = verifiedShifts.reduce((s, r) => s + Number(r.hours_worked || 0), 0);
  const revenue = verifiedShifts.reduce((s, r) => s + shiftBillableValue(r, machines), 0);
  const expenseTotal = periodExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const litres = periodFuel.reduce((s, f) => s + Number(f.litres || 0), 0);
  const runtimeMin = verifiedShifts.reduce((s, r) => s + Number(r.runtime_minutes || 0), 0);
  const downtimeMin = verifiedShifts.reduce((s, r) => s + Number(r.downtime_minutes || 0), 0);

  const activeMechanicJobs = maintenanceJobs.filter((j) => j.status !== MAINTENANCE_STATUS.COMPLETED);
  const completedMechanicJobs = maintenanceJobs.filter(
    (j) => j.status === MAINTENANCE_STATUS.COMPLETED && inPeriod(j.completed_at || j.updated_at, period)
  );

  const mechanicInspectionBatches = new Set(
    inspections
      .filter((i) => i.type === "Mechanic Inspection" && inPeriod(i.timestamp, period))
      .map((i) => i.inspection_id)
  );

  const prestartCount = new Set(
    inspections
      .filter((i) => i.type === "Pre-Start Inspection" && inPeriod(i.timestamp, period))
      .map((i) => i.inspection_id)
  ).size;

  const activeOperators = new Set(
    workSessions.filter((w) => w.status === "active").map((w) => w.operator_id)
  );

  const earlyClockOuts = workSessions.filter(
    (w) => w.status === "ended_early" && inPeriod(w.clock_out, period)
  ).length;

  const operatorShiftCounts = {};
  for (const s of verifiedShifts) {
    operatorShiftCounts[s.operator_id] = (operatorShiftCounts[s.operator_id] || 0) + 1;
  }
  const topOperator = Object.entries(operatorShiftCounts).sort((a, b) => b[1] - a[1])[0];
  const topOperatorProfile = topOperator ? profiles.find((p) => p.id === topOperator[0]) : null;

  const supervisorVerifyCounts = {};
  for (const s of verifiedShifts) {
    const key = s.supervisor_signature_name || s.verified_by || "Unknown";
    supervisorVerifyCounts[key] = (supervisorVerifyCounts[key] || 0) + 1;
  }
  const topSupervisor = Object.entries(supervisorVerifyCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    periodLabel: period.label,
    overview: {
      billableHours,
      revenue,
      expenseTotal,
      net: revenue - expenseTotal,
      litres,
      runtimeMin,
      downtimeMin,
      machinesActive: machines.filter((m) => m.active !== false).length,
      machinesRunning: runningShifts.length,
      machinesStopped: openStops.length,
      openIssues: openIssues.length,
      criticalIssues: criticalIssues.length,
      pendingVerify: pendingVerify.length,
      syncPending: syncState.pending || 0,
      earlyClockOuts,
    },
    roles: {
      operator: {
        label: "Operators",
        headcount: byRole(ROLES.OPERATOR).length,
        clockedIn: activeOperators.size,
        verifiedShifts: verifiedShifts.length,
        billableHours,
        topName: topOperatorProfile?.name || "—",
        topShifts: topOperator?.[1] || 0,
        prestartInspections: prestartCount,
        earlyClockOuts,
      },
      supervisor: {
        label: "Supervisors",
        headcount: byRole(ROLES.SUPERVISOR).length,
        pendingVerify: pendingVerify.length,
        verifiedThisPeriod: verifiedShifts.length,
        topName: topSupervisor?.[0] || "—",
        topCount: topSupervisor?.[1] || 0,
        openSiteIssues: openIssues.length,
      },
      mechanic: {
        label: "Mechanics",
        headcount: byRole(ROLES.MECHANIC).length,
        activeJobs: activeMechanicJobs.length,
        completedJobs: completedMechanicJobs.length,
        inspections: mechanicInspectionBatches.size,
        openBreakdowns: breakdowns.filter((b) => b.status !== "closed" && b.status !== "completed").length,
      },
      manager: {
        label: "Managers",
        headcount: byRole(ROLES.MANAGER).length,
        revenue,
        expenses: expenseTotal,
        net: revenue - expenseTotal,
        waitingParts: waitingParts.length,
        criticalIssues: criticalIssues.length,
      },
    },
    fleet: machines.filter((m) => m.active !== false).map((m) => {
      const running = runningShifts.some((s) => s.machine_id === m.id);
      const stopped = openStops.some((e) => e.machine_id === m.id);
      const stop = openStops.find((e) => e.machine_id === m.id);
      return {
        id: m.id,
        name: m.name,
        status: running ? "running" : stopped ? "stopped" : "idle",
        stopReason: stop?.reason,
      };
    }),
  };
}

export function formatAdminMetric(value, kind = "number") {
  if (kind === "money") return money(value);
  if (kind === "hours") return `${Number(value || 0).toFixed(1)}h`;
  if (kind === "duration") return formatDurationMinutes(value || 0);
  if (kind === "litres") return `${Number(value || 0).toFixed(1)} L`;
  return String(value ?? "—");
}
