import { useMemo, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { useLiveTimer } from "../hooks/useLiveTimer.js";
import { AppPage } from "../components/AppShell.jsx";
import { BackdateReadingModal } from "../components/BackdateReadingModal.jsx";
import { ActivityFeed } from "../components/ActivityFeed.jsx";
import { ExpenseModal } from "../components/ExpenseModal.jsx";
import { ImportExpensesModal } from "../components/ImportExpensesModal.jsx";
import { IssueInboxModal } from "../components/IssueInboxModal.jsx";
import { ReportIssueModal } from "../components/ReportIssueModal.jsx";
import { ReportPreviewModal } from "../components/ReportPreviewModal.jsx";
import { SignedReportCard } from "../components/SignedReportCard.jsx";
import { AlertModal } from "../components/ui/Modal.jsx";
import { ISSUE, SHIFT } from "../lib/constants.js";
import { shiftNameLines } from "../lib/shiftPeople.js";
import { formatDurationMinutes, formatDurationSeconds, HOUR_LABELS, shiftBillableHours } from "../lib/shiftMetrics.js";
import {
  fmtDateShort, getBillingPeriod, getDatePresets, getPrimaryMachine, hoursBetween, inPeriod, isLiveShift, isLiveSince, money, shiftBillableValue, dedupeShifts,
} from "../lib/utils.js";
import { ManagerPartsPanel } from "../components/manager/ManagerPartsPanel.jsx";
import { TimesheetPanel } from "../components/TimesheetPanel.jsx";
import { buildTimesheetRows } from "../lib/timesheet.js";
import { openShiftDailyReport, printOperationsReport, printTimesheetReport } from "../services/reports.js";
import { ProductivityPulseScreen } from "../components/ProductivityPulseScreen.jsx";
import { MoreMenu } from "../components/MoreMenu.jsx";
import { Chip } from "../components/ui/Chip.jsx";
import { StopReasonsEditor } from "../components/StopReasonsEditor.jsx";
import { Modal } from "../components/ui/Modal.jsx";
import * as wf from "../services/workflows.js";

const TABS = [
  { id: "overview", label: "Home" },
  { id: "pulse", label: "Pulse" },
  { id: "issues", label: "Problems" },
  { id: "reports", label: "Reports" },
  { id: "more", label: "More" },
];

const REPORT_FILTERS = [
  { id: "cycle", label: "This cycle" },
  { id: "month", label: "This month" },
  { id: "all", label: "All" },
];

const EXPENSE_FILTERS = [
  { id: "cycle", label: "This cycle" },
  { id: "month", label: "This month" },
  { id: "all", label: "All" },
];

export function ManagerApp() {
  const {
    user, shifts, events, expenses, fuelLogs, inspections, issues, issueMessages,
    workSessions, machines, profiles, submissions, hourReadings, activeSite, inventoryItems, syncNow, refreshLocal,
    getSettingsForSite, siteSettings,
  } = useOps();

  const [tab, setTab] = useState("overview");
  const [reportPreset, setReportPreset] = useState("cycle");
  const [timesheetFilter, setTimesheetFilter] = useState("cycle");
  const [signedFilter, setSignedFilter] = useState("cycle");
  const [expenseFilter, setExpenseFilter] = useState("cycle");
  const [showBackdate, setShowBackdate] = useState(false);
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [showImportExpenses, setShowImportExpenses] = useState(false);
  const [alert, setAlert] = useState({ isOpen: false });
  const [reportPreview, setReportPreview] = useState(null);
  const [moreView, setMoreView] = useState(null);
  const [showStopOwners, setShowStopOwners] = useState(false);
  const [focusMachineId, setFocusMachineId] = useState("");
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

  const expensePeriod = useMemo(() => {
    if (expenseFilter === "all") return null;
    if (expenseFilter === "cycle") return billingPeriod;
    const preset = getDatePresets(siteConfig.billing_cycle_start_day).find((p) => p.id === expenseFilter);
    return preset ? { start: preset.start, end: preset.end, label: preset.label } : billingPeriod;
  }, [expenseFilter, billingPeriod, siteConfig.billing_cycle_start_day]);

  const signedPeriod = useMemo(() => {
    if (signedFilter === "all") return null;
    if (signedFilter === "cycle") return billingPeriod;
    const preset = getDatePresets(siteConfig.billing_cycle_start_day).find((p) => p.id === signedFilter);
    return preset ? { start: preset.start, end: preset.end, label: preset.label } : billingPeriod;
  }, [signedFilter, billingPeriod, siteConfig.billing_cycle_start_day]);

  const timesheetPeriod = useMemo(() => {
    if (timesheetFilter === "all") return null;
    if (timesheetFilter === "cycle") return billingPeriod;
    const preset = getDatePresets(siteConfig.billing_cycle_start_day).find((p) => p.id === timesheetFilter);
    return preset ? { start: preset.start, end: preset.end, label: preset.label } : billingPeriod;
  }, [timesheetFilter, billingPeriod, siteConfig.billing_cycle_start_day]);

  const timesheetRows = useMemo(
    () => buildTimesheetRows(workSessions, { siteId: user?.site_id, period: timesheetPeriod }),
    [workSessions, user?.site_id, timesheetPeriod]
  );

  const warriorShifts = useMemo(
    () => shifts.filter((s) => s.machine_id === primaryMachine?.id),
    [shifts, primaryMachine?.id]
  );

  const cycleShifts = useMemo(
    () => warriorShifts.filter((s) => inPeriod(s.started_at, billingPeriod)),
    [warriorShifts, billingPeriod]
  );

  const cycleStats = useMemo(() => {
    const machineHours = cycleShifts.reduce((sum, s) => sum + Number(s.hours_worked || 0), 0);
    const billableHours = cycleShifts.reduce((sum, s) => sum + shiftBillableHours(s, events, siteConfig), 0);
    const revenue = cycleShifts.reduce((sum, s) => sum + shiftBillableValue(s, machines, events, siteConfig), 0);
    const runtimeMin = cycleShifts.reduce((sum, s) => sum + Number(s.runtime_minutes || 0), 0);
    const downtimeMin = cycleShifts.reduce((sum, s) => sum + Number(s.downtime_minutes || 0), 0);

    const warriorFuel = fuelLogs.filter(
      (f) => f.machine_id === primaryMachine?.id && inPeriod(f.timestamp, billingPeriod)
    );
    const litres = warriorFuel.reduce((sum, f) => sum + Number(f.litres || 0), 0);

    const warriorExpenses = expenses.filter(
      (e) => e.machine_id === primaryMachine?.id && inPeriod(e.date || e.created_at, billingPeriod)
    );
    const expenseTotal = warriorExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const closedStops = events.filter(
      (e) =>
        e.machine_id === primaryMachine?.id &&
        e.type === "STOP" &&
        e.status === "closed" &&
        inPeriod(e.stopped_at, billingPeriod)
    );
    const downtimeFromEvents = closedStops.reduce((sum, e) => sum + Number(e.downtime_minutes || 0), 0);

    const utilDenom = machineHours + downtimeFromEvents / 60;
    const utilization = utilDenom > 0 ? (machineHours / utilDenom) * 100 : 0;

    return {
      hours: machineHours,
      machineHours,
      billableHours,
      revenue,
      runtimeMin,
      downtimeMin,
      litres,
      expenseTotal,
      utilization,
      shiftCount: cycleShifts.length,
    };
  }, [cycleShifts, fuelLogs, expenses, events, primaryMachine?.id, machines, billingPeriod, siteConfig]);

  const fleetStatus = useMemo(() => {
    if (!primaryMachine) return null;
    const runningShift = shifts.find(
      (s) => s.machine_id === primaryMachine.id && s.shift_status === SHIFT.RUNNING && isLiveShift(s)
    ) || null;
    const openStop = runningShift
      ? events.find((e) => e.shift_id === runningShift.id && e.type === "STOP" && e.status === "open")
      : null;
    const activeSession = workSessions.find(
      (s) => s.status === "active" && isLiveSince(s.clock_in) && (
        s.machine_id === primaryMachine.id
        || (runningShift && s.operator_id === runningShift.operator_id)
      )
    );
    return {
      machine: primaryMachine,
      runningShift,
      openStop,
      activeSession,
      isRunning: !!runningShift && !openStop,
      isStopped: !!openStop,
    };
  }, [primaryMachine, shifts, events, workSessions]);

  const myIssues = useMemo(
    () => issues.filter(
      (i) =>
        i.status !== ISSUE.RESOLVED &&
        (i.machine_id === primaryMachine?.id || !i.machine_id) &&
        (i.current_owner_id === user?.id || i.reporter_id === user?.id)
    ),
    [issues, user?.id, primaryMachine?.id]
  );

  const assignedToMe = useMemo(
    () => issues.filter(
      (i) => i.status !== ISSUE.RESOLVED && i.current_owner_id === user?.id
    ),
    [issues, user?.id]
  );

  const partsRequests = useMemo(
    () => issues.filter(
      (i) => i.machine_id === primaryMachine?.id && i.status === ISSUE.WAITING_FOR_PARTS
    ),
    [issues, primaryMachine?.id]
  );

  const warriorOpenIssues = useMemo(
    () => issues.filter(
      (i) =>
        i.status !== ISSUE.RESOLVED &&
        (i.machine_id === primaryMachine?.id || (!i.machine_id && i.site_id === user?.site_id))
    ),
    [issues, primaryMachine?.id, user?.site_id]
  );

  const criticalWarriorIssues = useMemo(
    () => issues.filter(
      (i) =>
        i.status !== ISSUE.RESOLVED &&
        (i.machine_id === primaryMachine?.id || (!i.machine_id && i.site_id === user?.site_id)) &&
        i.priority === "Critical"
    ),
    [issues, primaryMachine?.id, user?.site_id]
  );

  const signedReports = useMemo(
    () => dedupeShifts(warriorShifts
      .filter(
        (s) =>
          s.shift_status === SHIFT.VERIFIED &&
          (s.supervisor_signature_ref || s.supervisor_signature_name || s.verified_at)
      )
      .filter((s) => !signedPeriod || inPeriod(s.verified_at || s.ended_at, signedPeriod)))
      .sort((a, b) => new Date(b.verified_at || b.ended_at || 0) - new Date(a.verified_at || a.ended_at || 0)),
    [warriorShifts, signedPeriod]
  );

  const filteredExpenses = useMemo(
    () => expenses
      .filter((e) => e.machine_id === primaryMachine?.id)
      .filter((e) => !expensePeriod || inPeriod(e.date || e.created_at, expensePeriod))
      .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at)),
    [expenses, primaryMachine?.id, expensePeriod]
  );

  const expenseByCategory = useMemo(() => {
    const map = {};
    for (const e of filteredExpenses) {
      const cat = e.category || "Other";
      map[cat] = (map[cat] || 0) + Number(e.amount || 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  const expensePeriodHours = useMemo(() => {
    const inScope = expensePeriod
      ? warriorShifts.filter((s) => inPeriod(s.started_at, expensePeriod))
      : warriorShifts;
    return {
      machine: inScope.reduce((sum, s) => sum + Number(s.hours_worked || 0), 0),
      billable: inScope.reduce((sum, s) => sum + shiftBillableHours(s, events, siteConfig), 0),
    };
  }, [warriorShifts, expensePeriod, events, siteConfig]);

  const expensePeriodRevenue = useMemo(() => {
    const inScope = expensePeriod
      ? warriorShifts.filter((s) => inPeriod(s.started_at, expensePeriod))
      : warriorShifts;
    return inScope.reduce((sum, s) => sum + shiftBillableValue(s, machines, events, siteConfig), 0);
  }, [warriorShifts, expensePeriod, machines, events, siteConfig]);

  const expenseDashboard = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const count = filteredExpenses.length;
    const [topCat, topAmt] = expenseByCategory[0] || ["—", 0];
    const avg = count > 0 ? total / count : 0;
    const costPerHour = expensePeriodHours.billable > 0 ? total / expensePeriodHours.billable : null;
    const pctRevenue = expensePeriodRevenue > 0 ? (total / expensePeriodRevenue) * 100 : null;
    const periodLabel = expensePeriod?.label || "All time";
    return { total, count, topCat, topAmt, avg, costPerHour, pctRevenue, periodLabel };
  }, [filteredExpenses, expenseByCategory, expensePeriodHours, expensePeriodRevenue, expensePeriod]);

  const warriorActivity = useMemo(() => ({
    events: events.filter((e) => e.machine_id === primaryMachine?.id),
    fuelLogs: fuelLogs.filter((f) => f.machine_id === primaryMachine?.id),
    issues: issues.filter((i) => i.machine_id === primaryMachine?.id),
  }), [events, fuelLogs, issues, primaryMachine?.id]);

  const reportContext = useMemo(() => ({
    events, inspections, fuelLogs, site: activeSite, shifts, hourReadings, siteSettings: siteConfig, profiles, workSessions,
  }), [events, inspections, fuelLogs, activeSite, shifts, hourReadings, siteConfig, profiles, workSessions]);

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
  }), [warriorShifts, warriorActivity, expenses, inspections, submissions, primaryMachine?.id, siteConfig]);

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
    fleetStatus?.isStopped;

  const tabItems = useMemo(
    () => TABS.map((t) => ({
      ...t,
      badge: t.id === "issues" ? myIssues.length + partsRequests.length : 0,
    })),
    [myIssues.length, partsRequests.length]
  );

  const headerContext = primaryMachine
    ? `${activeSite?.name || "Site"} · ${primaryMachine.name} · ${money(primaryMachine.billable_rate)}/h · ${billingPeriod.label}`
    : activeSite?.name;

  if (!primaryMachine) {
    return (
      <AppPage subtitle="Manager" context={headerContext} alert={<AlertModal {...alert} confirmText="OK" />}>
        <p className="py-12 text-center text-sm text-[#F2F0EA]/40">
          No primary machine configured for this site. Ask admin to add a machine and set the primary in Sites.
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
      onTabChange={(id) => { setTab(id); setMoreView(null); }}
      onSync={syncNow}
      alert={<AlertModal {...alert} confirmText="OK" />}
    >

        {needsAttention && (
          <div className="bg-[#1a1212] border border-[#EF4444]/30 rounded-xl px-3 py-3 mb-4 flex flex-wrap items-center gap-2">
            <span className="font-ui text-sm font-semibold text-[#EF4444]">Needs attention</span>
            {partsRequests.length > 0 && (
              <Chip tone="warn" onClick={() => setTab("issues")}>
                {partsRequests.length} parts request{partsRequests.length !== 1 ? "s" : ""}
              </Chip>
            )}
            {assignedToMe.length > 0 && (
              <Chip tone="gold" onClick={() => setTab("issues")}>
                {assignedToMe.length} issue{assignedToMe.length !== 1 ? "s" : ""} assigned to you
              </Chip>
            )}
            {criticalWarriorIssues.length > 0 && (
              <Chip tone="danger" onClick={() => setTab("issues")}>
                {criticalWarriorIssues.length} critical
              </Chip>
            )}
            {fleetStatus?.isStopped && (
              <Chip tone="warn" onClick={() => setTab("overview")}>
                Warrior stopped — {fleetStatus.openStop?.reason}
              </Chip>
            )}
          </div>
        )}

        {tab !== "pulse" && siteMachines.length > 1 && (
          <label className="block mb-4">
            <span className="font-ui text-xs font-semibold tracking-wider text-[#F5C518]">MACHINE</span>
            <select
              value={primaryMachine?.id || ""}
              onChange={(e) => setFocusMachineId(e.target.value)}
              className="ops-select mt-1"
            >
              {siteMachines.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <p className="font-body text-xs text-[#F2F0EA]/50 mt-1">Billable hours, machine hours, diesel, and expenses on this screen are for this machine only.</p>
          </label>
        )}

        {tab === "overview" && (
          <div className="space-y-4">
            <p className="font-body text-xs text-[#F2F0EA]/50">This machine · this cycle</p>
            <div className="grid grid-cols-2 gap-2">
              <Kpi label={HOUR_LABELS.billable} value={`${cycleStats.billableHours.toFixed(1)}h`} sub={`${cycleStats.shiftCount} shifts`} color="#22C55E" />
              <Kpi label={HOUR_LABELS.downtime} value={formatDurationMinutes(cycleStats.downtimeMin)} sub={HOUR_LABELS.downtimeHint} color="#EF4444" />
              <Kpi label={HOUR_LABELS.expenses} value={money(cycleStats.expenseTotal)} sub={HOUR_LABELS.expensesHint} color="#F5C518" />
              <Kpi
                label={HOUR_LABELS.net}
                value={money(cycleStats.revenue - cycleStats.expenseTotal)}
                sub={HOUR_LABELS.netHint}
                color="#F2F0EA"
              />
            </div>
            <p className="font-body text-xs text-ops-muted">Open Pulse or Reports for runtime, diesel, and full totals.</p>

            {fleetStatus && <WarriorStatusCard fleet={fleetStatus} workSessions={workSessions} profiles={profiles} />}

            <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">
              <p className="font-ui text-sm font-semibold text-[#F2F0EA]/70 mb-3">Recent activity</p>
              <ActivityFeed
                events={warriorActivity.events}
                fuelLogs={warriorActivity.fuelLogs}
                issues={warriorActivity.issues}
                machines={machines}
                siteId={user?.site_id}
                limit={15}
              />
            </div>
          </div>
        )}

        {tab === "issues" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowReportIssue(true)}
              className="w-full bg-[#EF4444] text-white py-3.5 rounded-xl font-ui font-semibold"
            >
              Report a problem
            </button>
            <p className="text-sm text-[#F2F0EA]/50">
              Machine issues go to the operator. Site, supplier, and staffing problems go to the supervisor.
            </p>
            {partsRequests.length > 0 && (
              <Chip tone="warn" className="w-full justify-start" onClick={() => { /* already on issues */ }}>
                {partsRequests.length} waiting for parts — open a problem below to mark ordered / on site
              </Chip>
            )}
            <IssueInboxModal
              variant="inline"
              scope="manager"
              user={user}
              issues={warriorOpenIssues}
              issueMessages={issueMessages}
              onDone={refreshLocal}
              onMarkPartsOrdered={(issue) => wf.markPartsOrdered(user, issue)}
              onMarkPartsOnSite={(issue) => wf.markPartsOnSite(user, issue)}
              machines={machines}
            />
          </div>
        )}

        {tab === "pulse" && <ProductivityPulseScreen embedded />}

        {tab === "more" && !moreView && (
          <MoreMenu
            items={[
              { label: "Parts catalog", onClick: () => setMoreView("parts") },
              { label: "Expenses", onClick: () => setMoreView("expenses") },
              { label: "Stop reasons and owners", onClick: () => setShowStopOwners(true) },
              { label: "Backdate hour reading", onClick: () => setShowBackdate(true) },
            ]}
          />
        )}

        {tab === "more" && moreView && (
          <button type="button" onClick={() => setMoreView(null)} className="ops-chip ops-chip-gold mb-3">
            ← Back
          </button>
        )}

        {tab === "more" && moreView === "parts" && (
          <ManagerPartsPanel
            siteId={user?.site_id}
            inventoryItems={inventoryItems}
            onSaved={refreshLocal}
            showAlert={showAlert}
          />
        )}

        {tab === "more" && moreView === "expenses" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowExpense(true)}
              className="w-full bg-[#00A4A6] text-white py-3.5 rounded-xl font-logo font-bold text-xs tracking-wider"
            >
              + LOG / BACKDATE EXPENSE
            </button>
            <button
              type="button"
              onClick={() => setShowImportExpenses(true)}
              className="w-full border border-[#F5C518]/50 text-[#F5C518] py-3.5 rounded-xl font-logo font-bold text-xs tracking-wider"
            >
              UPLOAD BANK RECON
            </button>

            <div className="flex flex-wrap gap-1">
              {EXPENSE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setExpenseFilter(f.id)}
                  className={`px-3 py-2 rounded-lg font-logo text-[10px] tracking-wider ${expenseFilter === f.id ? "bg-[#F5C518] text-black" : "bg-[#141414] border border-[#2A2A2A] text-[#F2F0EA]/70"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <p className="text-[10px] text-[#F2F0EA]/40">{primaryMachine.name} · {expenseDashboard.periodLabel}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Kpi label={HOUR_LABELS.expenses} value={money(expenseDashboard.total)} sub={`${expenseDashboard.count} entries`} color="#F5C518" />
              <Kpi
                label="Top Category"
                value={expenseDashboard.topCat}
                sub={expenseDashboard.topAmt ? money(expenseDashboard.topAmt) : "—"}
                color="#F2F0EA"
              />
              <Kpi label="Avg Entry" value={money(expenseDashboard.avg)} sub="Per transaction" color="#00A4A6" />
              <Kpi
                label="Cost / Hour"
                value={expenseDashboard.costPerHour != null ? money(expenseDashboard.costPerHour) : "—"}
                sub={expensePeriodHours.billable > 0 ? `${expensePeriodHours.billable.toFixed(1)}h billable hours · ${expensePeriodHours.machine.toFixed(1)}h machine hours` : "No signed hours"}
                color="#EF4444"
              />
              {expenseDashboard.pctRevenue != null && (
                <Kpi
                  label="% of Revenue"
                  value={`${expenseDashboard.pctRevenue.toFixed(1)}%`}
                  sub={money(expensePeriodRevenue)}
                  color="#22C55E"
                />
              )}
            </div>

            {expenseByCategory.length > 0 && (
              <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">
                <p className="font-logo text-[10px] text-[#F2F0EA]/50 mb-3 tracking-wider">BY CATEGORY</p>
                <div className="space-y-2">
                  {expenseByCategory.map(([cat, catTotal]) => {
                    const pct = expenseDashboard.total > 0 ? (catTotal / expenseDashboard.total) * 100 : 0;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between items-center gap-2 mb-1">
                          <span className="font-logo text-xs text-[#F2F0EA]/80">{cat}</span>
                          <span className="font-logo text-xs text-[#F5C518]">{money(catTotal)}</span>
                        </div>
                        <div className="h-1.5 bg-[#0A0A0A] rounded-full overflow-hidden">
                          <div className="h-full bg-[#F5C518]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredExpenses.length === 0 ? (
              <p className="text-sm text-[#F2F0EA]/40 text-center py-8">No expenses for this period.</p>
            ) : (
              <div className="space-y-2">
                {filteredExpenses.map((e) => (
                  <div key={e.id} className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-3 flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-logo text-xs">{e.category}</p>
                      <p className="text-[10px] text-[#F2F0EA]/40 truncate">{e.description || e.vendor || "—"}</p>
                      <p className="text-[9px] text-[#F2F0EA]/30 mt-0.5">{fmtDateShort(e.date)}</p>
                    </div>
                    <p className="font-logo text-[#F5C518] shrink-0">{money(e.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "reports" && (
          <div className="space-y-4">
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">
              <h3 className="font-logo text-[#F5C518] text-sm mb-3">OPERATIONS REPORT</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {getDatePresets(siteConfig.billing_cycle_start_day).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setReportPreset(p.id)}
                    className={`px-3 py-2 rounded-lg font-logo text-[10px] ${reportPreset === p.id ? "bg-[#F5C518] text-black" : "bg-[#0A0A0A] border border-[#2A2A2A]"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const doc = await printOperationsReport(warriorReportData, getReportPeriod(), primaryMachine, activeSite);
                    setReportPreview(doc);
                  } catch (e) {
                    showAlert("Could not open report", e.message, "error");
                  }
                }}
                className="w-full bg-[#F5C518] text-black py-4 rounded-xl font-logo font-bold tracking-wider"
              >
                👁 PREVIEW / PRINT OPERATIONS REPORT
              </button>
              <p className="text-[10px] text-[#F2F0EA]/40 mt-2">Warrior 2100 data only · works offline.</p>
            </div>

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

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h3 className="font-logo text-[#F5C518] text-sm">SIGNED DAILY REPORTS</h3>
                <div className="flex flex-wrap gap-1 ml-auto">
                  {REPORT_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSignedFilter(f.id)}
                      className={`px-2 py-1 rounded-lg font-logo text-[9px] tracking-wider ${signedFilter === f.id ? "bg-[#F5C518] text-black" : "bg-[#141414] border border-[#2A2A2A] text-[#F2F0EA]/70"}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              {signedReports.length === 0 ? (
                <p className="text-sm text-[#F2F0EA]/40 text-center py-6">No signed reports for this period.</p>
              ) : (
                <div className="space-y-3">
                  {signedReports.map((r) => (
                    <SignedReportCard
                      key={r.id}
                      shift={r}
                      machineName={primaryMachine.name}
                      events={events}
                      siteSettings={siteConfig}
                      onViewReport={handleViewReport}
                      onDownloadReport={handleViewReport}
                      onShareReport={handleViewReport}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      {showBackdate && (
        <BackdateReadingModal
          onClose={() => setShowBackdate(false)}
          user={user}
          machine={primaryMachine}
          site={activeSite}
          onDone={refreshLocal}
        />
      )}

      {showReportIssue && (
        <ReportIssueModal
          onClose={() => setShowReportIssue(false)}
          user={user}
          machine={primaryMachine}
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
          machine={primaryMachine}
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
          machine={primaryMachine}
          site={activeSite}
          onDone={refreshLocal}
          allowCustomDate
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

      {showStopOwners && (
        <Modal title="STOP REASONS & OWNERS" color="yellow" onClose={() => setShowStopOwners(false)}>
          <StopReasonsEditor
            siteId={user?.site_id}
            siteSettingsRow={siteSettingsRow}
            onSaved={async () => { await refreshLocal(); setShowStopOwners(false); }}
            showAlert={showAlert}
          />
        </Modal>
      )}
    </AppPage>
  );
}

function WarriorStatusCard({ fleet, workSessions = [], profiles = [] }) {
  const { machine, runningShift, openStop, activeSession, isRunning, isStopped } = fleet;
  const names = runningShift ? shiftNameLines(runningShift, { workSessions, profiles }) : null;
  const runningSeconds = useLiveTimer(runningShift?.started_at, isRunning);
  const downtimeSeconds = useLiveTimer(openStop?.stopped_at, isStopped);
  const statusColor = isStopped ? "#EF4444" : isRunning ? "#22C55E" : "#F2F0EA";
  const statusLabel = isStopped ? "STOPPED" : isRunning ? "RUNNING" : "IDLE";

  return (
    <div className={`bg-[#141414] border rounded-xl p-4 ${isStopped ? "border-[#EF4444]/50 bg-[#2a1616]/40" : "border-[#2A2A2A]"}`}>
      <div className="flex justify-between items-start gap-2 mb-2">
        <div>
          <p className="font-logo text-[10px] text-[#F2F0EA]/50 tracking-wider">LIVE STATUS</p>
          <p className="font-logo text-sm text-[#F2F0EA]">{machine.name}</p>
        </div>
        <p className="font-logo text-sm" style={{ color: statusColor }}>{statusLabel}</p>
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

function Kpi({ label, value, sub, color }) {
  return (
    <div className="rounded-xl p-3 sm:p-4 border" style={{ background: "var(--ops-gold-wash)", borderColor: "var(--ops-gold-line)" }}>
      <p className="font-logo text-[10px] text-[#F2F0EA]/50">{label}</p>
      <p className="font-logo text-xl sm:text-2xl" style={{ color }}>{value}</p>
      <p className="font-body text-[10px] text-[#F2F0EA]/40 mt-1">{sub}</p>
    </div>
  );
}
