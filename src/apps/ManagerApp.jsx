import { useMemo, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { useLiveTimer } from "../hooks/useLiveTimer.js";
import { AppPage } from "../components/AppShell.jsx";
import { BackdateReadingModal } from "../components/BackdateReadingModal.jsx";
import { EditExpenseModal, ExpenseCategoriesModal, ExpenseModal, ViewReceiptButton } from "../components/ExpenseModal.jsx";
import { ImportExpensesModal } from "../components/ImportExpensesModal.jsx";
import { IssueInboxModal } from "../components/IssueInboxModal.jsx";
import { ReportIssueModal } from "../components/ReportIssueModal.jsx";
import { ReportPreviewModal } from "../components/ReportPreviewModal.jsx";
import { AlertModal } from "../components/ui/Modal.jsx";
import { ISSUE, SHIFT } from "../lib/constants.js";
import { shiftNameLines } from "../lib/shiftPeople.js";
import { formatDurationMinutes, formatDurationSeconds, HOUR_LABELS, shiftBillableHours } from "../lib/shiftMetrics.js";
import { billableDetail, dieselDetail, downtimeDetail, expenseDetail, machineHourDetail, revenueDetail, shiftsStartedInPeriod, sumMeterHours } from "../lib/dashboardBreakdown.js";
import { DashboardKpi, KpiDetailModal } from "../components/DashboardKpi.jsx";
import { DispatchKpis } from "../components/DispatchKpis.jsx";
import {
  getBillingPeriod, getDatePresets, getPrimaryMachine, hoursBetween, inPeriod, isLiveShift, isLiveSince, localDayKey, money, onSiteRecord, shiftBillableValue, dedupeShifts, whenMs,
} from "../lib/utils.js";
import { TimesheetPanel } from "../components/TimesheetPanel.jsx";
import { buildTimesheetRows, summarizeTimesheet } from "../lib/timesheet.js";
import { openShiftDailyReport, printTimesheetReport } from "../services/reports.js";
import { OperationsReportPanel } from "../components/OperationsReportPanel.jsx";
import { dispatchDayReport } from "../lib/dispatchReport.js";
import { SupervisorReports } from "../components/SupervisorReports.jsx";
import { ReportsHub, REPORT_KIND } from "../components/ReportsHub.jsx";
import { RolePulse } from "../components/RolePulse.jsx";
import { WorkHoursPanel } from "../components/WorkHoursPanel.jsx";
import { MoreMenu } from "../components/MoreMenu.jsx";
import { StopReasonsEditor } from "../components/StopReasonsEditor.jsx";
import { currentShiftWindow } from "../lib/shiftAgreement.js";
import { normalizeExpenseCategories } from "../lib/siteConfig.js";
import { updateSiteSettings } from "../services/admin.js";
import { BucketSizeEditor } from "../components/BucketSizeEditor.jsx";
import { Modal } from "../components/ui/Modal.jsx";
import { Button } from "../components/ui/Button.jsx";

const TABS = [
  { id: "today", label: "Today" },
  { id: "pulse", label: "Pulse" },
  { id: "money", label: "Money" },
  { id: "reports", label: "Reports" },
  { id: "issues", label: "Problems" },
];

const MANAGER_REPORT_KINDS = [
  REPORT_KIND.daily,
  REPORT_KIND.operations,
  REPORT_KIND.timesheet,
  REPORT_KIND.dispatch,
];

function cycleSelectValue(value, cycles) {
  if (value === "all") return "all";
  if (cycles.some((cycle) => cycle.id === value)) return value;
  if (value === "cycle") return cycles[0]?.id || "all";
  return "all";
}

function CycleSelect({ value, cycles, onChange, allLabel }) {
  return (
    <label className="block">
      <span className="ops-field-label">Cycle</span>
      <select
        value={cycleSelectValue(value, cycles)}
        onChange={(event) => onChange(event.target.value)}
        className="w-full mt-1 bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl text-[#F2F0EA]"
      >
        <option value="all">{allLabel}</option>
        {cycles.map((cycle) => (
          <option key={cycle.id} value={cycle.id}>{cycle.label}</option>
        ))}
      </select>
    </label>
  );
}

function listCalendarMonths(count = 24) {
  const months = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    months.push({
      id: `month-${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      label: start.toLocaleDateString("en-ZA", { month: "long", year: "numeric" }),
      start,
      end,
    });
  }
  return months;
}

function listBillingCycles(cycleStartDay, count = 24) {
  const cycles = [];
  let cursor = new Date();
  for (let i = 0; i < count; i += 1) {
    const period = getBillingPeriod(cursor, cycleStartDay);
    cycles.push({
      id: `cycle-${period.start.toISOString().slice(0, 10)}`,
      ...period,
      label: i === 0 ? `This cycle · ${period.label}` : period.label,
    });
    cursor = new Date(period.start.getTime() - 86400000);
  }
  return cycles;
}

export function ManagerApp() {
  const {
    user, shifts, events, expenses, fuelLogs, inspections, issues, issueMessages,
    workSessions, machines, profiles, submissions, hourReadings, activeSite, syncNow, refreshLocal,
    getSettingsForSite, siteSettings, siteDispatch,
  } = useOps();

  const [tab, setTab] = useState("today");
  const [reportKind, setReportKind] = useState(null);
  const [reportMachineId, setReportMachineId] = useState(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [reportPreset, setReportPreset] = useState("cycle");
  const [timesheetFilter, setTimesheetFilter] = useState("cycle");
  const [signedFilter, setSignedFilter] = useState("cycle");
  const [expenseFilter, setExpenseFilter] = useState("all");
  const [moneyMachineId, setMoneyMachineId] = useState("");
  const [moneyCategory, setMoneyCategory] = useState("");
  const [showCategories, setShowCategories] = useState(false);
  const [showBackdate, setShowBackdate] = useState(false);
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showImportExpenses, setShowImportExpenses] = useState(false);
  const [alert, setAlert] = useState({ isOpen: false });
  const [kpiDetail, setKpiDetail] = useState(null);
  const [reportPreview, setReportPreview] = useState(null);
  const [showStopOwners, setShowStopOwners] = useState(false);
  const [showBucketSize, setShowBucketSize] = useState(false);
  const [focusMachineId, setFocusMachineId] = useState("");
  const [machineHourFilter, setMachineHourFilter] = useState("cycle");
  const showAlert = (title, message, type = "info") =>
    setAlert({ isOpen: true, title, message, type, onConfirm: () => setAlert({ isOpen: false }) });

  const siteConfig = useMemo(
    () => getSettingsForSite(user?.site_id),
    [getSettingsForSite, user?.site_id]
  );

  const siteSettingsRow = useMemo(
    () => siteSettings.find((s) => s.site_id === user?.site_id),
    [siteSettings, user?.site_id]
  );

  const siteMachines = useMemo(
    () => machines.filter((m) => m.site_id === user?.site_id && m.active !== false),
    [machines, user?.site_id]
  );

  const primaryMachine = useMemo(() => {
    const picked = siteMachines.find((m) => m.id === focusMachineId);
    if (picked) return picked;
    return getPrimaryMachine(machines, user?.site_id, siteConfig);
  }, [siteMachines, focusMachineId, machines, user?.site_id, siteConfig]);

  const billingPeriod = useMemo(
    () => getBillingPeriod(new Date(), siteConfig.billing_cycle_start_day),
    [siteConfig.billing_cycle_start_day]
  );
  const calendarMonths = useMemo(() => listCalendarMonths(24), []);
  const machineHourPeriod = useMemo(() => {
    if (machineHourFilter === "cycle") return billingPeriod;
    return calendarMonths.find((month) => month.id === machineHourFilter) || billingPeriod;
  }, [machineHourFilter, calendarMonths, billingPeriod]);

  const expenseCycles = useMemo(
    () => listBillingCycles(siteConfig.billing_cycle_start_day, 24),
    [siteConfig.billing_cycle_start_day]
  );
  const expensePeriod = useMemo(() => {
    if (expenseFilter === "all") return null;
    return expenseCycles.find((cycle) => cycle.id === expenseFilter) || null;
  }, [expenseFilter, expenseCycles]);

  const signedPeriod = useMemo(() => {
    if (signedFilter === "all") return null;
    if (signedFilter === "cycle") return expenseCycles[0] || billingPeriod;
    return expenseCycles.find((cycle) => cycle.id === signedFilter) || expenseCycles[0] || billingPeriod;
  }, [signedFilter, expenseCycles, billingPeriod]);

  const timesheetPeriod = useMemo(() => {
    if (timesheetFilter === "all") return null;
    if (timesheetFilter === "cycle") return billingPeriod;
    const preset = getDatePresets(siteConfig.billing_cycle_start_day).find((p) => p.id === timesheetFilter);
    return preset ? { start: preset.start, end: preset.end, label: preset.label } : billingPeriod;
  }, [timesheetFilter, billingPeriod, siteConfig.billing_cycle_start_day]);

  const timesheetRows = useMemo(
    () => buildTimesheetRows(
      (workSessions || []).filter((row) => onSiteRecord(row, user?.site_id, machines)),
      { period: timesheetPeriod }
    ),
    [workSessions, machines, user?.site_id, timesheetPeriod]
  );

  const warriorShifts = useMemo(
    () => shifts.filter((s) => onSiteRecord(s, user?.site_id, machines) && (!focusMachineId || s.machine_id === focusMachineId)),
    [shifts, machines, user?.site_id, focusMachineId]
  );

  const cycleShifts = useMemo(
    () => shiftsStartedInPeriod(warriorShifts, billingPeriod),
    [warriorShifts, billingPeriod]
  );
  const machineHourShifts = useMemo(
    () => shiftsStartedInPeriod(warriorShifts, machineHourPeriod),
    [warriorShifts, machineHourPeriod]
  );
  const trackedMachineHours = sumMeterHours(machineHourShifts);
  const trackedMeterCount = machineHourShifts.filter((shift) => shift.end_hour_meter != null && shift.start_hour_meter != null).length;

  const cycleStats = useMemo(() => {
    const machineHours = sumMeterHours(cycleShifts);
    const meterShiftCount = cycleShifts.filter((shift) => shift.end_hour_meter != null && shift.start_hour_meter != null).length;
    const billableHours = cycleShifts.reduce((sum, s) => sum + shiftBillableHours(s, events, siteConfig), 0);
    const revenue = cycleShifts.reduce((sum, s) => sum + shiftBillableValue(s, machines, events, siteConfig), 0);
    const runtimeMin = cycleShifts.reduce((sum, s) => sum + Number(s.runtime_minutes || 0), 0);
    const downtimeMin = cycleShifts.reduce((sum, s) => sum + Number(s.downtime_minutes || 0), 0);

    const onThisSite = (row) => onSiteRecord(row, user?.site_id, machines);
    const inFocus = (row) => !focusMachineId || row.machine_id === focusMachineId;
    const warriorFuel = fuelLogs.filter(
      (f) => onThisSite(f) && inFocus(f) && inPeriod(f.timestamp, billingPeriod)
    );
    const litres = warriorFuel.reduce((sum, f) => sum + Number(f.litres || 0), 0);

    const warriorExpenses = expenses.filter(
      (e) => onThisSite(e) && inFocus(e) && inPeriod(e.date || e.created_at, billingPeriod)
    );
    const expenseTotal = warriorExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const closedStops = events.filter(
      (e) =>
        onThisSite(e) &&
        inFocus(e) &&
        e.type === "STOP" &&
        e.status === "closed" &&
        inPeriod(e.stopped_at, billingPeriod)
    );
    const downtimeFromEvents = closedStops.reduce((sum, e) => sum + Number(e.downtime_minutes || 0), 0);

    const utilDenom = machineHours + downtimeFromEvents / 60;
    const utilization = utilDenom > 0 ? (machineHours / utilDenom) * 100 : 0;

    const machineName = (id) => machines.find((m) => m.id === id)?.name || primaryMachine?.name || "Machine";
    const scope = `${focusMachineId ? (primaryMachine?.name || "This machine") : "All machines"} · ${billingPeriod.label}`;
    const withScope = (detail) => ({ ...detail, scope });
    return {
      hours: machineHours,
      machineHours,
      meterShiftCount,
      billableHours,
      revenue,
      runtimeMin,
      downtimeMin,
      litres,
      expenseTotal,
      utilization,
      shiftCount: cycleShifts.length,
      details: {
        billable: withScope(billableDetail(cycleShifts, events, siteConfig, machineName)),
        machine: withScope(machineHourDetail(cycleShifts, machineName)),
        revenue: withScope(revenueDetail(cycleShifts, machines, events, siteConfig, machineName)),
        expenses: withScope(expenseDetail(warriorExpenses, machineName)),
        diesel: withScope(dieselDetail(warriorFuel, machineName)),
        downtime: withScope(downtimeDetail(cycleShifts, machineName)),
        net: {
          title: "Net",
          scope,
          note: "Revenue minus expenses for this machine in this cycle.",
          total: money(revenue - expenseTotal),
          rows: [
            { id: "revenue", title: "Revenue", detail: "Billable hours × rate", value: money(revenue) },
            { id: "expenses", title: "Expenses", detail: "Payments this cycle", value: money(expenseTotal) },
          ],
        },
      },
    };
  }, [cycleShifts, fuelLogs, expenses, events, focusMachineId, primaryMachine?.name, machines, user?.site_id, billingPeriod, siteConfig]);

  const fleets = useMemo(() => {
    const list = focusMachineId ? siteMachines.filter((machine) => machine.id === focusMachineId) : siteMachines;
    return list.map((machine) => {
      const runningShift = shifts.find(
        (s) => s.machine_id === machine.id && s.shift_status === SHIFT.RUNNING && isLiveShift(s)
      ) || null;
      const openStop = runningShift
        ? events.find((e) => e.shift_id === runningShift.id && e.type === "STOP" && e.status === "open")
        : null;
      const activeSession = workSessions.find(
        (s) => s.status === "active" && isLiveSince(s.clock_in) && (
          s.machine_id === machine.id
          || (runningShift && s.operator_id === runningShift.operator_id)
        )
      );
      return {
        machine,
        runningShift,
        openStop,
        activeSession,
        isRunning: !!runningShift && !openStop,
        isStopped: !!openStop,
      };
    });
  }, [focusMachineId, siteMachines, shifts, events, workSessions]);

  const siteOpenIssues = useMemo(
    () => issues.filter(
      (issue) =>
        issue.status !== ISSUE.RESOLVED &&
        onSiteRecord(issue, user?.site_id, machines) &&
        (!focusMachineId || !issue.machine_id || issue.machine_id === focusMachineId)
    ),
    [issues, user?.site_id, machines, focusMachineId]
  );

  const assignedToMe = useMemo(
    () => issues.filter(
      (i) => i.status !== ISSUE.RESOLVED && i.current_owner_id === user?.id
    ),
    [issues, user?.id]
  );

  const partsRequests = useMemo(
    () => siteOpenIssues.filter((issue) => issue.status === ISSUE.WAITING_FOR_PARTS),
    [siteOpenIssues]
  );

  const criticalWarriorIssues = useMemo(
    () => siteOpenIssues.filter((issue) => issue.priority === "Critical"),
    [siteOpenIssues]
  );

  const pendingVerify = useMemo(
    () => warriorShifts.filter(
      (s) => [SHIFT.WAITING_FOR_VERIFICATION, SHIFT.RESUBMITTED, SHIFT.SUBMITTED].includes(s.shift_status)
    ).length,
    [warriorShifts]
  );

  const awaitingSiteCount = useMemo(
    () => warriorShifts.filter((s) => s.shift_status === SHIFT.MACHINE_SIGNED).length,
    [warriorShifts]
  );

  const currentShift = useMemo(() => currentShiftWindow(), []);

  const signedReports = useMemo(
    () => dedupeShifts(shifts
      .filter(
        (s) =>
          onSiteRecord(s, user?.site_id, machines) &&
          (s.shift_status === SHIFT.VERIFIED || s.shift_status === SHIFT.MACHINE_SIGNED) &&
          (s.supervisor_signature_ref || s.supervisor_signature_name || s.verified_at)
      )
      .filter((s) => !signedPeriod || inPeriod(s.verified_at || s.ended_at, signedPeriod))
      .filter((s) => !reportMachineId || s.machine_id === reportMachineId))
      .sort((a, b) => new Date(b.verified_at || b.ended_at || 0) - new Date(a.verified_at || a.ended_at || 0)),
    [shifts, machines, user?.site_id, signedPeriod, reportMachineId]
  );

  const reportMachineCounts = useMemo(() => {
    const counts = {};
    for (const machine of siteMachines) counts[machine.id] = { signed: 0 };
    for (const shift of signedReports) {
      if (!reportMachineId && counts[shift.machine_id]) counts[shift.machine_id].signed += 1;
    }
    return counts;
  }, [siteMachines, signedReports, reportMachineId]);

  const hubCounts = useMemo(() => {
    const hours = summarizeTimesheet(timesheetRows).hours;
    return {
      daily: { sub: `${signedReports.length} signed this period` },
      operations: { sub: "Weekly and monthly by machine" },
      timesheet: { sub: `${hours.toFixed(1)}h on site` },
      dispatch: { sub: "Daily tonnes and trucks" },
    };
  }, [signedReports.length, timesheetRows]);

  const siteExpenses = useMemo(
    () => expenses.filter((e) => !e.site_id || onSiteRecord(e, user?.site_id, machines)),
    [expenses, machines, user?.site_id]
  );
  const expenseCategories = useMemo(() => {
    const picker = normalizeExpenseCategories(siteConfig.expense_categories);
    const extra = [];
    for (const expense of siteExpenses) {
      const name = expense.category || "Other";
      if (!picker.some((item) => item.toLowerCase() === name.toLowerCase()) && !extra.some((item) => item.toLowerCase() === name.toLowerCase())) {
        extra.push(name);
      }
    }
    return [...picker, ...extra];
  }, [siteConfig.expense_categories, siteExpenses]);
  const periodExpenses = useMemo(
    () => siteExpenses
      .filter((e) => !moneyMachineId || e.machine_id === moneyMachineId)
      .filter((e) => !expensePeriod || inPeriod(e.date || e.created_at, expensePeriod))
      .sort((a, b) => whenMs(b.date || b.created_at) - whenMs(a.date || a.created_at)),
    [siteExpenses, moneyMachineId, expensePeriod]
  );
  const filteredExpenses = useMemo(
    () => periodExpenses.filter((e) => !moneyCategory || (e.category || "Other") === moneyCategory),
    [periodExpenses, moneyCategory]
  );
  const moneyOut = periodExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const ledgerTotal = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const moneyShifts = useMemo(() => {
    const rows = shifts.filter(
      (shift) => onSiteRecord(shift, user?.site_id, machines) && (!moneyMachineId || shift.machine_id === moneyMachineId)
    );
    return dedupeShifts(rows);
  }, [shifts, machines, user?.site_id, moneyMachineId]);
  const moneyIn = useMemo(
    () => moneyShifts.reduce((sum, shift) => sum + shiftBillableValue(shift, machines, events, siteConfig), 0),
    [moneyShifts, machines, events, siteConfig]
  );

  const warriorActivity = useMemo(() => ({
    events: events.filter((e) => e.machine_id === primaryMachine?.id),
    fuelLogs: fuelLogs.filter((f) => f.machine_id === primaryMachine?.id),
    issues: issues.filter((i) => i.machine_id === primaryMachine?.id),
  }), [events, fuelLogs, issues, primaryMachine?.id]);

  const reportContext = useMemo(() => ({
    events, inspections, fuelLogs, site: activeSite, shifts, hourReadings, siteSettings: siteConfig, profiles, workSessions, siteDispatch,
  }), [events, inspections, fuelLogs, activeSite, shifts, hourReadings, siteConfig, profiles, workSessions, siteDispatch]);

  const getReportPeriod = () => {
    const presets = getDatePresets(siteConfig.billing_cycle_start_day);
    const p = presets.find((x) => x.id === reportPreset) || presets[4];
    return { start: p.start, end: p.end, label: p.label };
  };

  const warriorReportData = useMemo(() => ({
    shifts: warriorShifts,
    events: warriorActivity.events,
    expenses: expenses.filter((e) => e.machine_id === primaryMachine?.id),
    fuelLogs: warriorActivity.fuelLogs,
    inspections: inspections.filter((i) => i.machine_id === primaryMachine?.id),
    submissions,
    siteSettings: siteConfig,
    dispatches: siteDispatch,
  }), [warriorShifts, warriorActivity, expenses, inspections, submissions, primaryMachine?.id, siteConfig, siteDispatch]);

  const handleViewReport = async (shift) => {
    try {
      const doc = await openShiftDailyReport(shift, { ...reportContext, machine: primaryMachine });
      setReportPreview(doc);
    } catch (e) {
      showAlert("Could not open report", e.message, "error");
    }
  };

  const needsAttention =
    assignedToMe.length > 0 ||
    partsRequests.length > 0 ||
    criticalWarriorIssues.length > 0 ||
    fleets.some((fleet) => fleet.isStopped) ||
    pendingVerify > 0;

  const tabItems = useMemo(
    () => TABS.map((t) => ({
      ...t,
      badge: t.id === "issues" ? siteOpenIssues.length : 0,
    })),
    [siteOpenIssues.length]
  );

  const headerContext = activeSite?.name || "Site";

  const scopeName = focusMachineId ? (primaryMachine?.name || "This machine") : "All machines";
  const logMachine = primaryMachine || siteMachines[0] || null;

  if (!siteMachines.length) {
    return (
      <AppPage subtitle="Manager" context={headerContext} onSync={syncNow} alert={<AlertModal {...alert} confirmText="OK" />}>
        <p className="py-12 text-center text-sm text-[#F2F0EA]/40">
          No machines on this site yet. Ask admin to add one under Sites.
        </p>
      </AppPage>
    );
  }

  return (
    <AppPage
      subtitle="Manager"
      context={headerContext}
      showSite={false}
      tabs={tabItems}
      activeTab={tab}
      onTabChange={setTab}
      onSync={syncNow}
      alert={<AlertModal {...alert} confirmText="OK" />}
    >

        {needsAttention && (
          <div className="bg-[#1a1212] border border-[#EF4444]/30 rounded-2xl px-4 py-3 mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-ui text-xs font-semibold text-[#EF4444]">Needs attention</span>
            {partsRequests.length > 0 && (
              <span className="font-ui text-xs text-[#F97316]">
                {partsRequests.length} parts request{partsRequests.length !== 1 ? "s" : ""} with the storeroom
              </span>
            )}
            {assignedToMe.length > 0 && (
              <button type="button" onClick={() => setTab("issues")} className="btn-link font-ui text-xs text-[#F5C518] hover:underline">
                {assignedToMe.length} issue{assignedToMe.length !== 1 ? "s" : ""} assigned to you
              </button>
            )}
            {criticalWarriorIssues.length > 0 && (
              <button type="button" onClick={() => setTab("issues")} className="btn-link font-ui text-xs text-[#EF4444] hover:underline">
                {criticalWarriorIssues.length} critical
              </button>
            )}
            {fleets.some((fleet) => fleet.isStopped) && (
              <button type="button" onClick={() => setTab("today")} className="btn-link font-ui text-xs text-[#F97316] hover:underline">
                {fleets.filter((fleet) => fleet.isStopped).map((fleet) => fleet.machine.name).join(", ")} stopped
              </button>
            )}
            {pendingVerify > 0 && (
              <span className="font-ui text-xs text-[#F2F0EA]/50">
                {pendingVerify} shift{pendingVerify !== 1 ? "s" : ""} awaiting machine sign-off
              </span>
            )}
          </div>
        )}

        {tab !== "pulse" && (
          <div className="mb-4">
            <WorkHoursPanel variant="clock" />
          </div>
        )}

        {tab === "today" && siteMachines.length > 1 && (
          <label className="block mb-4">
            <span className="ops-field-label">Machine</span>
            <select
              value={focusMachineId}
              onChange={(e) => setFocusMachineId(e.target.value)}
              className="w-full mt-1 bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl text-[#F2F0EA]"
            >
              <option value="">All machines</option>
              {siteMachines.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
        )}

        {tab === "pulse" && <RolePulse />}

        {tab === "today" && (
          <div className="space-y-4">
            <p className="font-body text-xs text-[#F2F0EA]/50">{scopeName} · {billingPeriod.label} · {currentShift.label}</p>
            {awaitingSiteCount > 0 && (
              <p className="font-body text-xs text-[#F2F0EA]/50">
                {awaitingSiteCount} saved {awaitingSiteCount === 1 ? "shift" : "shifts"} still without a Berlington signature
              </p>
            )}
            <label className="block">
              <span className="ops-field-label">Machine hours</span>
              <select
                value={machineHourFilter}
                onChange={(event) => setMachineHourFilter(event.target.value)}
                className="w-full mt-1 bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl text-[#F2F0EA]"
              >
                <option value="cycle">This cycle</option>
                {calendarMonths.map((month) => (
                  <option key={month.id} value={month.id}>{month.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setKpiDetail({
                ...machineHourDetail(
                  machineHourShifts,
                  (id) => machines.find((machine) => machine.id === id)?.name || "Machine"
                ),
                scope: `${scopeName} · ${machineHourPeriod.label}`,
              })}
              className="w-full text-left bg-[#141414] border border-[#2A2A2A] rounded-2xl px-4 py-3"
            >
              <span className="block font-ui text-2xl font-semibold text-[#22C55E]">{trackedMachineHours.toFixed(1)}h</span>
              <span className="block font-body text-xs text-[#F2F0EA]/50 mt-1">
                {machineHourPeriod.label} · {trackedMeterCount} with a closing meter. Open for each shift.
              </span>
            </button>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <DashboardKpi label={HOUR_LABELS.billable} value={`${cycleStats.billableHours.toFixed(1)}h`} sub={`${cycleStats.shiftCount} shifts started · 8h minus Darkchild downtime`} color="#22C55E" onClick={() => setKpiDetail(cycleStats.details.billable)} />
              <DashboardKpi label={HOUR_LABELS.revenue} value={money(cycleStats.revenue)} sub={focusMachineId ? `${money(primaryMachine?.billable_rate)}/h on ${scopeName}` : `${scopeName} · each machine uses its own rate`} color="#22C55E" onClick={() => setKpiDetail(cycleStats.details.revenue)} />
              <DashboardKpi label={HOUR_LABELS.expenses} value={money(cycleStats.expenseTotal)} sub={`${scopeName} · this cycle`} color="#F5C518" onClick={() => setKpiDetail(cycleStats.details.expenses)} />
              <DashboardKpi label={HOUR_LABELS.downtime} value={formatDurationMinutes(cycleStats.downtimeMin)} sub="Stopped time on shifts this cycle" color="#EF4444" onClick={() => setKpiDetail(cycleStats.details.downtime)} />
              <DashboardKpi label={HOUR_LABELS.diesel} value={`${cycleStats.litres.toFixed(1)} L`} sub={cycleStats.machineHours > 0 ? `${(cycleStats.litres / cycleStats.machineHours).toFixed(2)} L per machine hour` : `${scopeName} · this cycle`} color="#F5C518" onClick={() => setKpiDetail(cycleStats.details.diesel)} />
              <DashboardKpi
                label={HOUR_LABELS.net}
                value={money(cycleStats.revenue - cycleStats.expenseTotal)}
                sub={`${scopeName} · revenue minus expenses`}
                color="#F2F0EA"
                onClick={() => setKpiDetail(cycleStats.details.net)}
              />
            </div>

            <DispatchKpis records={siteDispatch} siteId={user?.site_id || activeSite?.id} period={billingPeriod} factors={siteConfig} onOpen={setKpiDetail} />

            {fleets.map((fleet) => (
              <WarriorStatusCard key={fleet.machine.id} fleet={fleet} workSessions={workSessions} profiles={profiles} />
            ))}

            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-2">
              <Button variant="secondary" className="w-full" onClick={() => setSetupOpen((v) => !v)}>{setupOpen ? "Hide site setup" : "Site setup"}</Button>
              {setupOpen && (
                <div className="space-y-3 pt-1">
                  <MoreMenu
                    items={[
                      { label: "Bucket size", onClick: () => setShowBucketSize(true) },
                      { label: "Stop reasons and owners", onClick: () => setShowStopOwners(true) },
                      { label: "Backdate hour reading", onClick: () => setShowBackdate(true) },
                    ]}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "issues" && (
          <div className="space-y-3">
            <Button variant="danger" className="w-full" size="lg" onClick={() => setShowReportIssue(true)}>
              Report a problem
            </Button>
            {partsRequests.length > 0 && (
              <p className="font-body text-xs text-[#F97316]">
                {partsRequests.length} waiting for parts — the storeroom issues them
              </p>
            )}
            <IssueInboxModal
              variant="inline"
              scope="manager"
              user={user}
              issues={siteOpenIssues}
              issueMessages={issueMessages}
              onDone={refreshLocal}
              machines={machines}
            />
          </div>
        )}

        {tab === "money" && (
          <div className="space-y-3">
            <CycleSelect value={expenseFilter} cycles={expenseCycles} onChange={setExpenseFilter} allLabel="All expenses" />
            {siteMachines.length > 1 && (
              <label className="block">
                <span className="ops-field-label">Machine</span>
                <select
                  value={moneyMachineId}
                  onChange={(event) => setMoneyMachineId(event.target.value)}
                  className="w-full mt-1 bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl text-[#F2F0EA]"
                >
                  <option value="">All machines</option>
                  {siteMachines.map((machine) => (
                    <option key={machine.id} value={machine.id}>{machine.name}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-3 border border-[#2A2A2A] rounded-2xl overflow-hidden bg-[#141414]">
              <div className="px-3 py-3 border-r border-[#2A2A2A]">
                <p className="font-ui text-[11px] text-[#F2F0EA]/50">Revenue</p>
                <p className="font-ui text-sm font-semibold text-[#22C55E] mt-1">{money(moneyIn)}</p>
              </div>
              <div className="px-3 py-3 border-r border-[#2A2A2A]">
                <p className="font-ui text-[11px] text-[#F2F0EA]/50">Expenses</p>
                <p className="font-ui text-sm font-semibold text-[#F5C518] mt-1">{money(moneyOut)}</p>
              </div>
              <div className="px-3 py-3">
                <p className="font-ui text-[11px] text-[#F2F0EA]/50">Net</p>
                <p className="font-ui text-sm font-semibold text-[#F2F0EA] mt-1">{money(moneyIn - moneyOut)}</p>
              </div>
            </div>
            <p className="font-body text-xs text-[#F2F0EA]/45">Revenue is every billable hour on record, times each machine rate. Expenses follow the cycle above.</p>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="teal" onClick={() => setShowExpense(true)}>Log expense</Button>
              <Button variant="secondary" onClick={() => setShowImportExpenses(true)}>Upload bank recon</Button>
            </div>

            <label className="block">
              <span className="ops-field-label">Category</span>
              <select
                value={expenseCategories.includes(moneyCategory) ? moneyCategory : ""}
                onChange={(event) => setMoneyCategory(event.target.value)}
                className="w-full mt-1 bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl text-[#F2F0EA]"
              >
                <option value="">All categories</option>
                {expenseCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => setShowCategories(true)} className="font-ui text-sm text-[#F5C518] text-left">
              Add or remove categories
            </button>
            <p className="font-body text-sm text-ops-muted">
              {moneyCategory ? `${moneyCategory} · ` : ""}
              {filteredExpenses.length} {filteredExpenses.length === 1 ? "payment" : "payments"}
              {moneyCategory ? ` · ${money(ledgerTotal)}` : ""}
            </p>
            <ExpenseDays expenses={filteredExpenses} machines={machines} onEdit={setEditingExpense} />
          </div>
        )}

        {tab === "reports" && (
          <ReportsHub
            kinds={MANAGER_REPORT_KINDS}
            machines={siteMachines}
            kind={reportKind}
            machineId={reportMachineId}
            onKind={setReportKind}
            onMachine={setReportMachineId}
            counts={hubCounts}
            machineCounts={reportMachineCounts}
          >
            {reportKind === "daily" && (
              <div className="space-y-3">
                <CycleSelect value={signedFilter} cycles={expenseCycles} onChange={setSignedFilter} allLabel="All reports" />
                <SupervisorReports
                  machines={siteMachines}
                  machineId={reportMachineId || ""}
                  period={signedPeriod}
                  periodLabel={signedPeriod?.label || "All time"}
                  signedReports={signedReports}
                  machineName={(id) => siteMachines.find((machine) => machine.id === id)?.name || id}
                  events={events}
                  siteConfig={siteConfig}
                  dispatches={siteDispatch}
                  onView={handleViewReport}
                />
              </div>
            )}

            {reportKind === "operations" && (
              <OperationsReportPanel
                site={activeSite}
                machines={siteMachines}
                machineId={reportMachineId || primaryMachine?.id || ""}
                onMachine={setReportMachineId}
                hideMachineSelect
                cycleStartDay={siteConfig.billing_cycle_start_day}
                data={{
                  shifts,
                  events,
                  expenses,
                  fuelLogs,
                  inspections,
                  siteSettings: siteConfig,
                  dispatches: siteDispatch,
                }}
              />
            )}

            {reportKind === "timesheet" && (
              <TimesheetPanel
                rows={timesheetRows}
                periodLabel={timesheetPeriod?.label || "All time"}
                filter={timesheetFilter}
                onFilter={setTimesheetFilter}
                machines={machines}
                onPreview={async () => {
                  try {
                    const doc = await printTimesheetReport(workSessions, timesheetPeriod, activeSite, machines);
                    setReportPreview(doc);
                  } catch (e) {
                    showAlert("Could not open timesheet", e.message, "error");
                  }
                }}
              />
            )}

            {reportKind === "dispatch" && (
              <div className="space-y-3">
              <CycleSelect value={signedFilter} cycles={expenseCycles} onChange={setSignedFilter} allLabel="All reports" />
              <SupervisorReports
                group="dispatch"
                period={signedPeriod}
                periodLabel={signedPeriod?.label || "All time"}
                dispatches={(siteDispatch || []).filter((row) => onSiteRecord(row, user?.site_id, machines))}
                onOpenDispatch={async (row) => {
                  try {
                    setReportPreview(await dispatchDayReport(row, activeSite));
                  } catch (e) {
                    showAlert("Could not open dispatch report", e.message, "error");
                  }
                }}
              />
              </div>
            )}
          </ReportsHub>
        )}

      {showBackdate && (
        <BackdateReadingModal
          onClose={() => setShowBackdate(false)}
          user={user}
          machine={logMachine}
          site={activeSite}
          onDone={refreshLocal}
        />
      )}

      {showReportIssue && (
        <ReportIssueModal
          onClose={() => setShowReportIssue(false)}
          user={user}
          machine={logMachine}
          machines={siteMachines.length ? siteMachines : (primaryMachine ? [primaryMachine] : [])}
          site={activeSite}
          profiles={profiles}
          onDone={refreshLocal}
        />
      )}

      {showImportExpenses && (
        <ImportExpensesModal
          onClose={() => setShowImportExpenses(false)}
          user={user}
          machine={logMachine}
          machines={siteMachines}
          site={activeSite}
          existing={expenses}
          onDone={() => { refreshLocal(); showAlert("Expenses saved", "Bank payments were added and will sync.", "success"); }}
        />
      )}

      {showExpense && (
        <ExpenseModal
          onClose={() => setShowExpense(false)}
          user={user}
          machine={logMachine}
          site={activeSite}
          onDone={refreshLocal}
          allowCustomDate
          categories={normalizeExpenseCategories(siteConfig.expense_categories)}
        />
      )}

      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onDone={refreshLocal}
          categories={normalizeExpenseCategories(siteConfig.expense_categories)}
        />
      )}

      {showCategories && (
        <ExpenseCategoriesModal
          categories={normalizeExpenseCategories(siteConfig.expense_categories)}
          onClose={() => setShowCategories(false)}
          onSave={async (list) => {
            await updateSiteSettings(user?.site_id || activeSite?.id, { expense_categories: list });
            await refreshLocal();
          }}
        />
      )}

      {reportPreview && (
        <ReportPreviewModal
          html={reportPreview.html}
          title={reportPreview.title}
          sheets={reportPreview.sheets}
          onClose={() => setReportPreview(null)}
        />
      )}

      {showBucketSize && (
        <Modal title="Bucket size" color="yellow" onClose={() => setShowBucketSize(false)}>
          <BucketSizeEditor
            siteId={user?.site_id || activeSite?.id}
            settings={siteConfig}
            onSaved={async () => { await syncNow(); setShowBucketSize(false); }}
            showAlert={showAlert}
          />
        </Modal>
      )}

      {showStopOwners && (
        <Modal title="Stop reasons and owners" color="yellow" onClose={() => setShowStopOwners(false)}>
          <StopReasonsEditor
            siteId={user?.site_id}
            siteSettingsRow={siteSettingsRow}
            onSaved={async () => { await refreshLocal(); setShowStopOwners(false); }}
            showAlert={showAlert}
          />
        </Modal>
      )}
      <KpiDetailModal detail={kpiDetail} onClose={() => setKpiDetail(null)} />
    </AppPage>
  );
}

function WarriorStatusCard({ fleet, workSessions = [], profiles = [] }) {
  const { machine, runningShift, openStop, activeSession, isRunning, isStopped } = fleet;
  const names = runningShift ? shiftNameLines(runningShift, { workSessions, profiles }) : null;
  const runningSeconds = useLiveTimer(runningShift?.started_at, isRunning);
  const downtimeSeconds = useLiveTimer(openStop?.stopped_at, isStopped);
  const statusColor = isStopped ? "#EF4444" : isRunning ? "#22C55E" : "#F2F0EA";
  const statusLabel = isStopped ? "Stopped" : isRunning ? "Running" : "Idle";

  return (
    <div className={`bg-[#141414] border rounded-2xl p-4 ${isStopped ? "border-[#EF4444]/50 bg-[#2a1616]/40" : "border-[#2A2A2A]"}`}>
      <div className="flex justify-between items-start gap-2 mb-2">
        <div>
          <p className="font-ui text-xs text-[#F2F0EA]/50">Live status</p>
          <p className="font-ui text-sm font-semibold text-[#F2F0EA]">{machine.name}</p>
        </div>
        <p className="font-ui text-sm font-semibold" style={{ color: statusColor }}>{statusLabel}</p>
      </div>
      {isRunning && (
        <p className="text-sm text-[#F2F0EA]/70">
          {Math.floor(runningSeconds / 3600)}h {Math.floor((runningSeconds % 3600) / 60)}m · {names.machineOperator}
          {!names.samePerson ? ` · recorded by ${names.recordedBy}` : ""}
        </p>
      )}
      {isStopped && (
        <div>
          <p className="font-logo text-sm text-[#EF4444]">{openStop.reason}</p>
          <p className="text-sm text-[#F2F0EA]/70 mt-1">
            {formatDurationSeconds(downtimeSeconds)} · {openStop.operator_name}
          </p>
        </div>
      )}
      {!isRunning && !isStopped && activeSession && (
        <p className="text-sm text-[#F2F0EA]/50">
          {activeSession.operator_name} on site · {hoursBetween(activeSession.clock_in).toFixed(1)}h
        </p>
      )}
      {!isRunning && !isStopped && !activeSession && (
        <p className="text-sm text-[#F2F0EA]/40">No active shift</p>
      )}
    </div>
  );
}

function expenseDayKey(iso) {
  const value = String(iso || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return iso ? (localDayKey(iso) || "undated") : "undated";
}

function managerDayLabel(iso) {
  const key = expenseDayKey(iso);
  if (!key || key === "undated") return "Undated";
  const today = localDayKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === today) return "Today";
  if (key === localDayKey(yesterday)) return "Yesterday";
  return new Date(`${key}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

function ExpenseDays({ expenses, machines = [], onEdit }) {
  const [openDay, setOpenDay] = useState(null);
  const [openId, setOpenId] = useState(null);
  const machineName = (id) => machines.find((machine) => machine.id === id)?.name || "";
  if (!expenses.length) {
    return <p className="text-sm text-[#F2F0EA]/40 text-center py-8">No expenses for this period.</p>;
  }
  const days = [];
  for (const expense of expenses) {
    const iso = expense.date || expense.created_at;
    const key = expenseDayKey(iso);
    const last = days[days.length - 1];
    if (last?.key === key) last.rows.push(expense);
    else days.push({ key, label: managerDayLabel(iso), total: 0, rows: [expense] });
  }
  for (const day of days) day.total = day.rows.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  return (
    <div className="border border-[#2A2A2A] rounded-2xl overflow-hidden">
      {days.map((day) => {
        const open = openDay === day.key;
        return (
          <div key={day.key} className="border-b border-[#2A2A2A] last:border-b-0">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => { setOpenDay(open ? null : day.key); setOpenId(null); }}
              className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left bg-[#141414]"
            >
              <span className="font-ui font-semibold text-[#F5C518]">{day.label}</span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="font-ui text-sm text-[#F2F0EA]">{money(day.total)}</span>
                <span className={`text-[#F5C518] transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>›</span>
              </span>
            </button>
            {open && day.rows.map((expense) => {
              const detailsOpen = openId === expense.id;
              const machine = machineName(expense.machine_id);
              return (
                <div key={expense.id} className="border-t border-[#2A2A2A] bg-[#0A0A0A]">
                  <button
                    type="button"
                    aria-expanded={detailsOpen}
                    onClick={() => setOpenId(detailsOpen ? null : expense.id)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left"
                  >
                    <span className="font-body text-sm text-[#F2F0EA] truncate">{expense.description || expense.vendor || expense.category || "Payment"}</span>
                    <span className="font-ui text-sm text-[#F5C518] shrink-0">{money(expense.amount)}</span>
                  </button>
                  {detailsOpen && (
                    <div className="px-3 pb-3 space-y-1">
                      <p className="font-body text-xs text-[#F2F0EA]/55">{expense.category || "Other"}{machine ? ` · ${machine}` : ""}</p>
                      {expense.vendor && expense.vendor !== expense.description && (
                        <p className="font-body text-xs text-[#F2F0EA]/55">{expense.vendor}</p>
                      )}
                      <ViewReceiptButton expense={expense} className="block pt-1" />
                      <button type="button" onClick={() => onEdit(expense)} className="font-ui text-sm text-[#F2F0EA]/70">
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
