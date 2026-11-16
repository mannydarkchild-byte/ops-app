import { useEffect, useMemo, useRef, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { AppPage } from "../components/AppShell.jsx";
import { IssueInboxModal } from "../components/IssueInboxModal.jsx";
import { ROLES, SHIFT, ISSUE } from "../lib/constants.js";
import { contractorDowntimeMinutes, formatDurationMinutes, shiftBillableHours } from "../lib/shiftMetrics.js";
import { DashboardKpi, KpiDetailModal } from "../components/DashboardKpi.jsx";
import { DispatchDayForm } from "../components/DispatchDayForm.jsx";
import { DispatchSignoffList } from "../components/DispatchSignoffList.jsx";
import {
  getBillingPeriod,
  getDatePresets,
  getShiftStatus,
  inPeriod,
  isLiveShift,
  isLiveSince,
  localDayKey,
  dedupeShifts,
  fmtDateShort,
} from "../lib/utils.js";
import { hydrateOpenShiftsFromServer, loadShiftFromVerifyLink, normalizeShiftLinkId } from "../lib/machineStatus.js";
import { needsBerlingtonSign, siteSignLink, siteSignShareText, whatsappShareUrl } from "../lib/shiftAgreement.js";
import { openWhatsApp } from "../lib/whatsapp.js";
import { RolePulse } from "../components/RolePulse.jsx";
import { WorkHoursPanel } from "../components/WorkHoursPanel.jsx";
import { SupervisorReports } from "../components/SupervisorReports.jsx";
import { OperationsReportPanel } from "../components/OperationsReportPanel.jsx";
import { TimesheetPanel } from "../components/TimesheetPanel.jsx";
import { ReportsHub, REPORT_KIND } from "../components/ReportsHub.jsx";
import { buildTimesheetRows, summarizeTimesheet } from "../lib/timesheet.js";
import { openShiftDailyReport, printTimesheetReport } from "../services/reports.js";
import { dispatchDayReport } from "../lib/dispatchReport.js";
import {
  DISPATCH_STATUS,
  cycleDispatchTargetTonnes,
  dispatchStatus,
  productionForShift,
  screenedTonnes,
  summarizeDispatch,
  tonnesLabel,
} from "../lib/dispatchMetrics.js";
import { BucketSizeEditor } from "../components/BucketSizeEditor.jsx";
import { pickLineFleet, tonnesPerBucket } from "../lib/siteConfig.js";
import * as wf from "../services/workflows.js";
import { Button } from "../components/ui/Button.jsx";
import { FieldSelect } from "../components/ui/FieldSelect.jsx";
import { AlertModal, Modal } from "../components/ui/Modal.jsx";
import { ReportIssueModal } from "../components/ReportIssueModal.jsx";
import { ReportPreviewModal } from "../components/ReportPreviewModal.jsx";
import { SupervisorShiftEdit } from "../components/SupervisorShiftEdit.jsx";
import { SupervisorVerifySheet } from "../components/SupervisorVerifySheet.jsx";

const TABS = [
  { id: "issues", label: "Problems" },
  { id: "home", label: "Home" },
  { id: "pulse", label: "Pulse" },
  { id: "reports", label: "Reports" },
];

const REPORT_FILTERS = [
  { id: "cycle", label: "This cycle" },
  { id: "all", label: "All" },
];

const SUPERVISOR_REPORT_KINDS = [
  REPORT_KIND.daily,
  REPORT_KIND.operations,
  REPORT_KIND.timesheet,
  REPORT_KIND.dispatch,
];

export function SupervisorApp({ verifyShiftId = null, verifyToken = null, onVerifyConsumed }) {
  const {
    shifts, events, issues, issueMessages, workSessions, machines, profiles,
    fuelLogs, expenses, inspections, hourReadings, siteDispatch, activeSite,
    user, refreshLocal, syncNow, getSettingsForSite,
  } = useOps();

  const siteConfig = useMemo(
    () => getSettingsForSite(user?.site_id || activeSite?.id),
    [getSettingsForSite, user?.site_id, activeSite?.id]
  );
  const dispatchFactors = useMemo(() => ({
    excavator_bucket_tonnes: tonnesPerBucket(siteConfig.excavator_bucket_tonnes),
    fel_bucket_tonnes: tonnesPerBucket(siteConfig.fel_bucket_tonnes),
  }), [siteConfig.excavator_bucket_tonnes, siteConfig.fel_bucket_tonnes]);
  const dispatchSite = activeSite?.id ? activeSite : { id: user?.site_id, name: "Site" };

  const [tab, setTab] = useState(verifyShiftId ? "reports" : "home");
  const [showBucketSize, setShowBucketSize] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(null);
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [verifyScope, setVerifyScope] = useState("all");
  const [signature, setSignature] = useState(null);
  const [reportFilter, setReportFilter] = useState("cycle");
  const [reportKind, setReportKind] = useState(null);
  const [reportMachineId, setReportMachineId] = useState(null);
  const [timesheetFilter, setTimesheetFilter] = useState("cycle");
  const [linkedShift, setLinkedShift] = useState(null);
  const [linkedDoc, setLinkedDoc] = useState(null);
  const [linkedError, setLinkedError] = useState("");
  const [linkedLoading, setLinkedLoading] = useState(false);
  const [delegateIssueId, setDelegateIssueId] = useState(null);
  const [delegateTargetId, setDelegateTargetId] = useState("");
  const [delegateNote, setDelegateNote] = useState("");
  const [delegateBusy, setDelegateBusy] = useState(false);
  const [mechanicIssueId, setMechanicIssueId] = useState(null);
  const [mechanicTargetId, setMechanicTargetId] = useState("");
  const [mechanicNote, setMechanicNote] = useState("");
  const [mechanicBusy, setMechanicBusy] = useState(false);
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [reasonModal, setReasonModal] = useState(null);
  const [alert, setAlert] = useState({ isOpen: false });
  const [justSigned, setJustSigned] = useState(null);
  const [resendBusy, setResendBusy] = useState(null);
  const [kpiDetail, setKpiDetail] = useState(null);
  const [reportPreview, setReportPreview] = useState(null);
  const [dispatchBusy, setDispatchBusy] = useState(null);
  const [closeShift, setCloseShift] = useState(null);
  const [closeMeter, setCloseMeter] = useState("");
  const [closeBusy, setCloseBusy] = useState(false);
  const [editShift, setEditShift] = useState(null);
  const [pulseMachineId, setPulseMachineId] = useState("");

  const showAlert = (title, message, type = "info") => setAlert({
    isOpen: true, title, message, type, onConfirm: () => setAlert({ isOpen: false }),
  });

  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    const refreshTick = async () => {
      if (document.visibilityState !== "visible") return;
      if (navigator.onLine) await hydrateOpenShiftsFromServer().catch(() => {});
      if (!cancelled) await refreshLocal().catch(() => {});
    };
    refreshTick();
    const refreshId = setInterval(refreshTick, 60000);
    return () => { cancelled = true; clearInterval(refreshId); };
  }, [user?.id, refreshLocal]);

  const siteMachines = useMemo(
    () => machines.filter((m) => m.site_id === user?.site_id && m.active !== false),
    [machines, user?.site_id]
  );
  const siteIssues = useMemo(() => issues.filter((i) => i.site_id === user?.site_id), [issues, user?.site_id]);
  const openSiteIssues = useMemo(() => siteIssues.filter((i) => i.status !== ISSUE.RESOLVED), [siteIssues]);

  const fleetStatus = useMemo(() => siteMachines.map((machine) => {
    const runningShift = shifts.find((s) => s.machine_id === machine.id && getShiftStatus(s) === SHIFT.RUNNING && isLiveShift(s)) || null;
    const openStop = runningShift
      ? events.find((e) => e.shift_id === runningShift.id && e.type === "STOP" && e.status === "open")
      : null;
    const activeSession = workSessions.find((s) => s.status === "active" && isLiveSince(s.clock_in) && (
      s.machine_id === machine.id || (runningShift && s.operator_id === runningShift.operator_id)
    ));
    return {
      machine,
      runningShift,
      openStop,
      activeSession,
      isRunning: !!runningShift && !openStop,
      isStopped: !!openStop,
    };
  }), [siteMachines, shifts, events, workSessions]);

  const openShiftsToClose = useMemo(() => (
    dedupeShifts(shifts.filter((shift) => getShiftStatus(shift) === SHIFT.RUNNING))
      .sort((a, b) => new Date(a.started_at || 0) - new Date(b.started_at || 0))
  ), [shifts]);

  const pendingShifts = dedupeShifts(shifts
    .filter((r) => {
      if (![SHIFT.WAITING_FOR_VERIFICATION, SHIFT.RESUBMITTED, SHIFT.SUBMITTED].includes(getShiftStatus(r))) return false;
      if (user?.role === ROLES.ADMIN || user?.role === ROLES.MANAGER) return true;
      return r.site_id === user?.site_id || r.assigned_supervisor_id === user?.id;
    }))
    .sort((a, b) => {
      const aMine = a.assigned_supervisor_id === user?.id ? 0 : 1;
      const bMine = b.assigned_supervisor_id === user?.id ? 0 : 1;
      return aMine - bMine || new Date(b.ended_at || 0) - new Date(a.ended_at || 0);
    });

  const awaitingSiteShifts = useMemo(() => dedupeShifts(shifts
    .filter((r) => {
      if (!needsBerlingtonSign(r)) return false;
      if (user?.role === ROLES.ADMIN || user?.role === ROLES.MANAGER) return true;
      return r.site_id === user?.site_id || r.assigned_supervisor_id === user?.id;
    }))
    .sort((a, b) => new Date(b.machine_signed_at || b.verified_at || b.updated_at || 0) - new Date(a.machine_signed_at || a.verified_at || a.updated_at || 0)),
  [shifts, user?.site_id, user?.id, user?.role]);

  const displayedPendingShifts = useMemo(() => {
    const list = verifyScope === "all"
      ? pendingShifts
      : pendingShifts.filter((s) => s.assigned_supervisor_id === user?.id);
    if (!verifyShiftId) return list;
    return [...list].sort((a, b) => (a.id === verifyShiftId ? -1 : b.id === verifyShiftId ? 1 : 0));
  }, [pendingShifts, verifyScope, user?.id, verifyShiftId]);

  const awaitingCorrectionShifts = useMemo(
    () => shifts
      .filter((r) => getShiftStatus(r) === SHIFT.CORRECTION_REQUIRED && r.site_id === user?.site_id)
      .sort((a, b) => new Date(b.updated_at || b.ended_at || 0) - new Date(a.updated_at || a.ended_at || 0)),
    [shifts, user?.site_id]
  );
  const displayedAwaitingCorrection = useMemo(() => (
    verifyScope === "all"
      ? awaitingCorrectionShifts
      : awaitingCorrectionShifts.filter((s) => s.assigned_supervisor_id === user?.id)
  ), [awaitingCorrectionShifts, verifyScope, user?.id]);

  const myPendingVerify = pendingShifts.filter((s) => s.assigned_supervisor_id === user?.id).length;
  const dispatchWaiting = (siteDispatch || []).filter((row) => row.site_id === user?.site_id && row.assigned_supervisor_id === user?.id && dispatchStatus(row) === DISPATCH_STATUS.WAITING).length;

  const reportPeriod = useMemo(() => {
    if (reportFilter === "all") return null;
    const preset = getDatePresets(siteConfig.billing_cycle_start_day).find((p) => p.id === reportFilter);
    if (preset) return { start: preset.start, end: preset.end, label: preset.label };
    return getBillingPeriod(new Date(), siteConfig.billing_cycle_start_day);
  }, [reportFilter, siteConfig.billing_cycle_start_day]);

  const signedReports = useMemo(() => (
    dedupeShifts(shifts
      .filter((s) => (
        getShiftStatus(s) === SHIFT.VERIFIED &&
        s.site_id === user?.site_id &&
        (s.supervisor_signature_ref || s.supervisor_signature_name || s.machine_signature_ref || s.machine_signature_name || s.verified_at)
      ))
      .filter((s) => !reportPeriod || inPeriod(s.verified_at || s.ended_at, reportPeriod)))
      .sort((a, b) => new Date(b.verified_at || b.ended_at || 0) - new Date(a.verified_at || a.ended_at || 0))
  ), [shifts, user?.site_id, reportPeriod]);

  const dailyReportShifts = useMemo(() => {
    const seen = new Set();
    const rows = [];
    const add = (shift) => {
      if (!shift?.id || seen.has(shift.id)) return;
      if (getShiftStatus(shift) === SHIFT.RUNNING) return;
      if (reportMachineId && shift.machine_id !== reportMachineId) return;
      const status = getShiftStatus(shift);
      const stillOpen = status === SHIFT.CORRECTION_REQUIRED
        || status === SHIFT.WAITING_FOR_VERIFICATION
        || status === SHIFT.RESUBMITTED
        || status === SHIFT.SUBMITTED
        || needsBerlingtonSign(shift);
      const when = shift.started_at || shift.ended_at || shift.verified_at;
      if (!stillOpen && reportPeriod && !inPeriod(when, reportPeriod)) return;
      seen.add(shift.id);
      rows.push(shift);
    };
    for (const shift of displayedPendingShifts) add(shift);
    for (const shift of displayedAwaitingCorrection) add(shift);
    for (const shift of awaitingSiteShifts) add(shift);
    for (const shift of signedReports) add(shift);
    return rows.sort((a, b) => new Date(b.started_at || b.ended_at || 0) - new Date(a.started_at || a.ended_at || 0));
  }, [displayedPendingShifts, displayedAwaitingCorrection, awaitingSiteShifts, signedReports, reportMachineId, reportPeriod]);

  const timesheetPeriod = useMemo(() => {
    if (timesheetFilter === "all") return null;
    if (timesheetFilter === "cycle") return getBillingPeriod(new Date(), siteConfig.billing_cycle_start_day);
    const preset = getDatePresets(siteConfig.billing_cycle_start_day).find((p) => p.id === timesheetFilter);
    return preset ? { start: preset.start, end: preset.end, label: preset.label } : reportPeriod;
  }, [timesheetFilter, siteConfig.billing_cycle_start_day, reportPeriod]);

  const timesheetRows = useMemo(
    () => buildTimesheetRows(workSessions, { siteId: user?.site_id, period: timesheetPeriod }),
    [workSessions, user?.site_id, timesheetPeriod]
  );

  const reportMachineCounts = useMemo(() => {
    const counts = {};
    for (const machine of siteMachines) counts[machine.id] = { waiting: 0, send: 0, signed: 0 };
    for (const shift of pendingShifts) {
      if (counts[shift.machine_id]) counts[shift.machine_id].waiting += 1;
    }
    for (const shift of awaitingSiteShifts) {
      if (counts[shift.machine_id]) counts[shift.machine_id].send += 1;
    }
    for (const shift of signedReports) {
      if (counts[shift.machine_id]) counts[shift.machine_id].signed += 1;
    }
    return counts;
  }, [siteMachines, pendingShifts, awaitingSiteShifts, signedReports]);

  const reportAttention = useMemo(
    () => siteMachines
      .map((machine) => {
        const count = reportMachineCounts[machine.id] || {};
        const line = [
          count.waiting ? `${count.waiting} waiting` : "",
          count.send ? `${count.send} to send` : "",
        ].filter(Boolean).join(" · ");
        return line ? { machineId: machine.id, name: machine.name, line } : null;
      })
      .filter(Boolean),
    [siteMachines, reportMachineCounts]
  );

  const hubCounts = useMemo(() => {
    const waiting = pendingShifts.length + awaitingSiteShifts.length;
    const hours = summarizeTimesheet(timesheetRows).hours;
    return {
      daily: {
        badge: waiting ? `${waiting} need you` : "",
        sub: "Sign, send, and filed copies",
      },
      operations: { sub: "Weekly and monthly by machine" },
      timesheet: { sub: `${hours.toFixed(1)}h on site` },
      dispatch: {
        badge: dispatchWaiting ? `${dispatchWaiting} waiting` : "",
        sub: "Daily tonnes and trucks",
      },
    };
  }, [pendingShifts.length, awaitingSiteShifts.length, timesheetRows, dispatchWaiting]);

  const billingPeriod = useMemo(
    () => getBillingPeriod(new Date(), siteConfig.billing_cycle_start_day),
    [siteConfig.billing_cycle_start_day]
  );

  const machineName = (machineId) => machines.find((m) => m.id === machineId)?.name || machineId;
  const berlingtonName = siteConfig?.equipment_owner_name || "Berlington";

  const homeKpis = useMemo(() => {
    const summary = summarizeDispatch(siteDispatch, user?.site_id, billingPeriod, siteConfig);
    const cycleTarget = cycleDispatchTargetTonnes(siteConfig, billingPeriod);
    const cycleTonnes = summary.weighbridge || 0;
    const todayKey = localDayKey();
    const todayRow = summary.todayRow;
    const trucksToday = todayRow?.trucks_dispatched ?? 0;
    const hasProduction = (row) => row && (
      row.excavator_buckets != null
      || row.fel_buckets != null
      || screenedTonnes(row, siteConfig) != null
      || row.tonnes_on_floor != null
    );
    const focusRow = hasProduction(todayRow)
      ? todayRow
      : [...summary.rows].reverse().find((row) => hasProduction(row)) || null;
    return {
      cycleTonnes,
      cycleTarget,
      cycleProgress: cycleTarget > 0 ? cycleTonnes / cycleTarget : 0,
      trucksToday,
      trucksCycle: summary.trucks || 0,
      screened: summary.screened,
      screenedToday: focusRow ? screenedTonnes(focusRow, siteConfig) : null,
      excavatorBuckets: focusRow?.excavator_buckets ?? null,
      felBuckets: focusRow?.fel_buckets ?? null,
      floor: summary.floor,
      details: summary.details,
      line: pickLineFleet(fleetStatus),
      todayKey,
    };
  }, [user?.site_id, siteDispatch, siteConfig, billingPeriod, fleetStatus]);

  const reportContext = useMemo(() => ({
    events, inspections, fuelLogs, expenses, site: activeSite, shifts, hourReadings, siteSettings: siteConfig, profiles, workSessions, siteDispatch,
  }), [events, inspections, fuelLogs, expenses, activeSite, shifts, hourReadings, siteConfig, profiles, workSessions, siteDispatch]);

  const handleViewReport = async (shift) => {
    const machine = machines.find((m) => m.id === shift.machine_id);
    try {
      setReportPreview(await openShiftDailyReport(shift, { ...reportContext, machine }));
    } catch (e) {
      showAlert("Could not open report", e.message, "error");
    }
  };

  const closeLinkedReport = () => {
    setLinkedShift(null);
    setLinkedDoc(null);
    setLinkedError("");
    setLinkedLoading(false);
    setVerifyTarget(null);
    setSignature(null);
    onVerifyConsumed?.();
  };

  const openLinkedReport = async (shift) => {
    if (!shift) return;
    setTab("reports");
    setReportKind("daily");
    setReportMachineId(shift.machine_id || null);
    setLinkedShift(shift);
    setVerifyTarget(shift);
    setSignature(null);
    setLinkedError("");
    setLinkedLoading(true);
    setLinkedDoc(null);
    try {
      const machine = machines.find((m) => m.id === shift.machine_id);
      setLinkedDoc(await openShiftDailyReport(shift, { ...reportContext, machine }));
    } catch (e) {
      setLinkedError(e.message || "Could not open this report");
    } finally {
      setLinkedLoading(false);
    }
  };

  const openBerlingtonWhatsApp = (shift) => {
    if (!shift?.site_token) return;
    const link = siteSignLink(shift);
    const billableHours = shiftBillableHours(shift, events, siteConfig);
    const deducted = contractorDowntimeMinutes(events, shift, siteConfig);
    const downtimeLine = deducted > 0
      ? `Contractor downtime deducted: ${formatDurationMinutes(deducted)}`
      : "No contractor downtime deducted";
    openWhatsApp(whatsappShareUrl("", siteSignShareText(
      shift,
      machineName(shift.machine_id),
      link,
      berlingtonName,
      { billableHours, downtimeLine }
    )));
  };

  const sendToBerlington = async (shift) => {
    setResendBusy(shift.id);
    try {
      const updated = await wf.requestSiteSign(user, shift);
      await refreshLocal();
      setJustSigned(updated);
      openBerlingtonWhatsApp(updated);
    } catch (e) {
      showAlert("Could not send", e.message, "error");
    } finally {
      setResendBusy(null);
    }
  };

  const delegateCandidates = useMemo(
    () => (profiles || []).filter((p) => p.site_id === user?.site_id && p.active !== false && [ROLES.OPERATOR, ROLES.MANAGER].includes(p.role)),
    [profiles, user?.site_id]
  );
  const mechanicCandidates = useMemo(
    () => (profiles || []).filter((p) => p.site_id === user?.site_id && p.active !== false && p.role === ROLES.MECHANIC),
    [profiles, user?.site_id]
  );

  const handleDelegate = async () => {
    const issue = openSiteIssues.find((i) => i.id === delegateIssueId);
    const assignee = delegateCandidates.find((p) => p.id === delegateTargetId);
    if (!issue || !assignee) {
      showAlert("Select person", "Choose an operator or manager to send this to.", "warning");
      return;
    }
    setDelegateBusy(true);
    try {
      await wf.delegateIssue(user, issue, assignee, delegateNote);
      await refreshLocal();
      setDelegateIssueId(null);
      setDelegateTargetId("");
      setDelegateNote("");
      showAlert("Sent", `Problem sent to ${assignee.name}.`, "success");
    } catch (e) {
      showAlert("Failed", e.message, "error");
    }
    setDelegateBusy(false);
  };

  const handleSendToMechanic = async () => {
    const issue = openSiteIssues.find((i) => i.id === mechanicIssueId);
    const mechanic = mechanicCandidates.find((p) => p.id === mechanicTargetId);
    const machine = siteMachines.find((m) => m.id === issue?.machine_id) || siteMachines[0];
    if (!issue || !mechanic) {
      showAlert("Select mechanic", "Choose a mechanic for this repair.", "warning");
      return;
    }
    setMechanicBusy(true);
    try {
      await wf.sendToMechanic(user, issue, mechanic, machine, activeSite, mechanicNote);
      await refreshLocal();
      setMechanicIssueId(null);
      setMechanicTargetId("");
      setMechanicNote("");
      showAlert("Sent", `Repair job sent to ${mechanic.name}.`, "success");
    } catch (e) {
      showAlert("Failed", e.message, "error");
    }
    setMechanicBusy(false);
  };

  const verifyOpened = useRef(null);
  const shiftsRef = useRef(shifts);
  shiftsRef.current = shifts;
  const [verifyRetry, setVerifyRetry] = useState(0);

  useEffect(() => {
    if (!verifyShiftId) {
      verifyOpened.current = null;
      return undefined;
    }
    if (verifyOpened.current === verifyShiftId) return undefined;
    setTab("reports");
    setReportKind("daily");
    setLinkedLoading(true);
    setLinkedError("");
    setLinkedShift((prev) => (prev?.id === verifyShiftId ? prev : { id: verifyShiftId }));
    let cancelled = false;

    const run = async () => {
      let shift = null;
      let lastError = "";
      for (let i = 0; i < 4 && !cancelled && !shift; i += 1) {
        try {
          const id = normalizeShiftLinkId(verifyShiftId);
          shift = (shiftsRef.current || []).find((s) => s.id === id)
            || await loadShiftFromVerifyLink(id, verifyToken, user);
        } catch (e) {
          lastError = e.message || "";
        }
        if (shift) break;
        await new Promise((resolve) => window.setTimeout(resolve, 1000 * (i + 1)));
      }
      if (cancelled) return;
      if (!shift) {
        setLinkedError(lastError || "Could not load this report from the server. Tap Try again.");
        setLinkedLoading(false);
        return;
      }
      verifyOpened.current = verifyShiftId;
      await openLinkedReport(shift);
    };

    run();
    return () => { cancelled = true; };
  }, [verifyShiftId, verifyToken, verifyRetry]);

  const openReasonModal = (shift, action) => {
    setReasonModal({
      shift,
      action,
      reason: "",
      title: action === "correct" ? "Why are you sending this back?" : "Why escalate?",
      placeholder: action === "correct" ? "Tell the operator what to fix" : "Explain the problem",
    });
  };

  const handleReasonConfirm = async () => {
    const reason = reasonModal?.reason?.trim();
    if (!reason || !reasonModal?.shift) return;
    const { shift, action } = reasonModal;
    setReasonModal(null);
    setVerifyBusy(shift.id);
    try {
      if (!navigator.onLine) {
        showAlert("Offline", "This action requires connection.", "warning");
        setVerifyBusy(null);
        return;
      }
      await wf.verifyShift(shift, user, { action, reason, signatureDataUrl: null });
      await syncNow();
      await refreshLocal();
      closeLinkedReport();
      showAlert("Sent back", "The operator will see your note and can fix the report.", "success");
    } catch (e) {
      showAlert("Failed", e.message, "error");
    }
    setVerifyBusy(null);
  };

  const handleVerify = async (action) => {
    if (!verifyTarget) return;
    if (action !== "machine_sign") {
      openReasonModal(verifyTarget, action);
      return;
    }
    if (!signature) {
      showAlert("Signature required", "Draw your signature before signing.", "warning");
      return;
    }
    setVerifyBusy(verifyTarget.id);
    try {
      if (!navigator.onLine) {
        showAlert("Offline", "Sign-off needs a connection so the link can reach the server.", "warning");
        setVerifyBusy(null);
        return;
      }
      const signed = await wf.verifyShift(verifyTarget, user, { action: "machine_sign", reason: null, signatureDataUrl: signature });
      await syncNow();
      const locked = signed || { ...verifyTarget, shift_status: SHIFT.MACHINE_SIGNED };
      setVerifyTarget(null);
      setSignature(null);
      setLinkedShift(null);
      setLinkedDoc(null);
      onVerifyConsumed?.();
      await sendToBerlington(locked);
      await refreshLocal();
    } catch (e) {
      showAlert("Failed", e.message, "error");
    }
    setVerifyBusy(null);
  };

  const handleSignDispatch = async (row) => {
    setDispatchBusy(row.id);
    try {
      const signed = await wf.signSiteDispatch(user, row);
      await refreshLocal();
      if (navigator.onLine) await syncNow();
      setReportPreview({
        ...(await dispatchDayReport(signed, activeSite)),
        startShareOpen: true,
      });
    } catch (e) {
      showAlert("Could not sign", e.message, "error");
    } finally {
      setDispatchBusy(null);
    }
  };

  const handleReturnDispatch = async (row) => {
    const note = window.prompt("What should Dispatch correct?");
    if (note == null) return;
    setDispatchBusy(row.id);
    try {
      await wf.returnSiteDispatch(user, row, note);
      await refreshLocal();
      showAlert("Sent back", "Dispatch can edit that day again.", "success");
    } catch (e) {
      showAlert("Could not send back", e.message, "error");
    } finally {
      setDispatchBusy(null);
    }
  };

  const assignedDispatch = useMemo(
    () => (siteDispatch || []).filter((row) => row.site_id === user?.site_id && row.assigned_supervisor_id === user?.id),
    [siteDispatch, user?.site_id, user?.id]
  );

  const openPulse = (machineId) => {
    setPulseMachineId(machineId || "");
    setTab("pulse");
  };

  const tabItems = useMemo(() => TABS.map((t) => ({
    ...t,
    badge: t.id === "reports"
      ? myPendingVerify + dispatchWaiting + awaitingSiteShifts.length
      : t.id === "issues" ? openSiteIssues.length : 0,
  })), [myPendingVerify, dispatchWaiting, awaitingSiteShifts.length, openSiteIssues.length]);

  const viewTab = tab === "live" || tab === "today" ? "home" : tab === "verify" || tab === "dispatch" ? "reports" : tab;
  const headerContext = activeSite?.name || "Site";

  return (
    <AppPage
      subtitle="Supervisor"
      context={headerContext}
      showSite={false}
      tabs={tabItems}
      activeTab={viewTab}
      onTabChange={(id) => {
        setTab(id);
        if (id !== "reports") {
          setReportKind(null);
          setReportMachineId(null);
        }
      }}
      onSync={syncNow}
      maxWidth="max-w-2xl"
      alert={<AlertModal {...alert} confirmText="OK" />}
    >
      {viewTab !== "pulse" && (
        <div className="mb-4">
          <WorkHoursPanel variant="clock" />
        </div>
      )}
      {viewTab === "home" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {homeKpis.line.map((line) => (
              <LineStatusCard
                key={line.id}
                line={line}
                onOpen={() => line.fleet?.machine?.id && openPulse(line.fleet.machine.id)}
              />
            ))}
          </div>

          <div className="space-y-3">
            <p className="font-ui text-sm font-semibold text-ops-muted">Production</p>
            <DashboardKpi
              label="Dispatch this cycle"
              value={tonnesLabel(homeKpis.cycleTonnes)}
              sub={`${Math.round(homeKpis.cycleProgress * 100)}% of ${tonnesLabel(homeKpis.cycleTarget)} - ${billingPeriod.label}`}
              color={homeKpis.cycleProgress >= 1 ? "#22C55E" : "#F5C518"}
              progress={homeKpis.cycleProgress}
              onClick={() => setKpiDetail({
                title: "Dispatch this cycle",
                scope: `${activeSite?.name || "This site"} - ${billingPeriod.label}`,
                note: "Weighbridge tonnes against the cycle target.",
                total: `${tonnesLabel(homeKpis.cycleTonnes)} / ${tonnesLabel(homeKpis.cycleTarget)}`,
                rows: homeKpis.details?.weighbridge?.rows || [],
              })}
            />
            <div className="grid grid-cols-2 gap-2">
              <DashboardKpi
                label="Trucks today"
                value={String(homeKpis.trucksToday)}
                sub={`${homeKpis.trucksCycle} this cycle`}
                color="#F5C518"
                onClick={() => setKpiDetail(homeKpis.details?.trucks)}
              />
              <DashboardKpi
                label="Material screened"
                value={tonnesLabel(homeKpis.screenedToday ?? homeKpis.screened)}
                sub={[
                  homeKpis.excavatorBuckets != null ? `${homeKpis.excavatorBuckets} excavator buckets` : null,
                  `${tonnesLabel(homeKpis.screened)} this cycle`,
                ].filter(Boolean).join(" · ")}
                color="#22C55E"
                onClick={() => setKpiDetail(homeKpis.details?.screened)}
              />
            </div>
            <DashboardKpi
              label="On the floor"
              value={tonnesLabel(homeKpis.floor)}
              sub={[
                homeKpis.felBuckets != null ? `${homeKpis.felBuckets} FEL buckets` : null,
                "Latest closing stock",
              ].filter(Boolean).join(" · ")}
              color="#00A4A6"
              onClick={() => setKpiDetail(homeKpis.details?.floor)}
            />
            {(!dispatchFactors.excavator_bucket_tonnes || !dispatchFactors.fel_bucket_tonnes) && (
              <button
                type="button"
                onClick={() => setShowBucketSize(true)}
                className="w-full text-left font-body text-sm text-[#F5C518] bg-[#F5C518]/10 border border-[#F5C518]/40 rounded-2xl p-4"
              >
                Set tonnes per excavator bucket and tonnes per FEL bucket. Bucket counts stay as counts until those two numbers are saved.
              </button>
            )}
          </div>

          {openShiftsToClose.length > 0 && (
            <div className="space-y-2">
              <p className="font-ui text-sm font-semibold text-ops-muted">Open shifts</p>
              {openShiftsToClose.map((shift) => (
                <button
                  key={shift.id}
                  type="button"
                  onClick={() => { setCloseShift(shift); setCloseMeter(String(shift.start_hour_meter ?? "")); }}
                  className="w-full text-left bg-ops-card border border-ops-gold rounded-2xl p-4"
                >
                  <p className="font-ui font-semibold text-ops-text">{machineName(shift.machine_id)}</p>
                  <p className="font-body text-sm text-ops-muted mt-1">{shift.operator_name || "Operator"} - still open</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {viewTab === "pulse" && (
        <RolePulse initialMachineId={pulseMachineId} />
      )}

      {viewTab === "reports" && (
        <ReportsHub
          kinds={SUPERVISOR_REPORT_KINDS}
          machines={siteMachines}
          kind={reportKind}
          machineId={reportMachineId}
          onKind={setReportKind}
          onMachine={setReportMachineId}
          counts={hubCounts}
          machineCounts={reportMachineCounts}
          attention={reportAttention}
        >
          {reportKind === "daily" && (
            <div className="space-y-6">
              <FieldSelect value={reportFilter} onChange={setReportFilter}>
                {REPORT_FILTERS.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </FieldSelect>
              <DailyReportsByDate
                shifts={dailyReportShifts}
                periodLabel={reportPeriod?.label || "All time"}
                berlingtonName={berlingtonName}
                machineName={machineName}
                verifyBusy={verifyBusy}
                resendBusy={resendBusy}
                siteConfig={siteConfig}
                siteDispatch={siteDispatch}
                onOpen={openLinkedReport}
                onSendBack={(row) => openReasonModal(row, "correct")}
                onView={handleViewReport}
                onSend={sendToBerlington}
                onEdit={setEditShift}
              />
            </div>
          )}

          {reportKind === "operations" && (
            <OperationsReportPanel
              site={activeSite}
              machines={siteMachines}
              machineId={reportMachineId || siteMachines[0]?.id || ""}
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
            <div className="space-y-4">
              <DispatchDayForm
                selfSign
                allowCorrect
                records={siteDispatch}
                siteId={user?.site_id}
                factors={dispatchFactors}
                onSave={async (fields) => {
                  await wf.saveSiteDispatch(user, dispatchSite, fields, dispatchFactors, { preserveStatus: true });
                  await refreshLocal();
                  showAlert("Saved", "Draft kept on this phone.", "success");
                }}
                onSubmit={async (fields) => {
                  const signed = await wf.completeSiteDispatch(user, dispatchSite, fields, dispatchFactors);
                  await refreshLocal();
                  if (navigator.onLine) await syncNow();
                  setReportPreview({
                    ...(await dispatchDayReport(signed, dispatchSite)),
                    startShareOpen: true,
                  });
                }}
                onPreview={async (row) => setReportPreview(await dispatchDayReport(row, dispatchSite))}
              />
              <p className="font-ui text-sm font-semibold text-ops-text pt-2">Waiting to sign</p>
              <DispatchSignoffList
                rows={assignedDispatch}
                busyId={dispatchBusy}
                emptyHint="No dispatch day from Dispatch is waiting to sign."
                onPreview={async (row) => setReportPreview(await dispatchDayReport(row, activeSite))}
                onSign={handleSignDispatch}
                onReturn={handleReturnDispatch}
              />
              <p className="font-ui text-sm font-semibold text-ops-text pt-2">Signed</p>
              <SupervisorReports
                group="dispatch"
                period={reportPeriod}
                periodLabel={reportPeriod?.label || "All time"}
                filter={reportFilter}
                filters={REPORT_FILTERS}
                onFilter={setReportFilter}
                dispatches={(siteDispatch || []).filter((row) => row.site_id === user?.site_id)}
                onOpenDispatch={async (row) => setReportPreview(await dispatchDayReport(row, activeSite))}
              />
            </div>
          )}
        </ReportsHub>
      )}

      {viewTab === "issues" && (
        <div className="space-y-3">
          <Button className="w-full" size="lg" variant="danger" onClick={() => setShowReportIssue(true)}>
            Report a problem
          </Button>
          <IssueInboxModal
            variant="inline"
            user={user}
            issues={siteIssues}
            issueMessages={issueMessages}
            onDone={refreshLocal}
            scope="site"
            siteId={user?.site_id}
            onSendTo={(issue) => { setDelegateIssueId(issue.id); setDelegateTargetId(""); setDelegateNote(""); }}
            onSendToMechanic={(issue) => { setMechanicIssueId(issue.id); setMechanicTargetId(""); setMechanicNote(""); }}
            machines={siteMachines}
          />
        </div>
      )}

      {showReportIssue && (
        <ReportIssueModal
          onClose={() => setShowReportIssue(false)}
          user={user}
          machines={siteMachines}
          site={activeSite}
          profiles={profiles}
          onDone={refreshLocal}
        />
      )}

      {delegateIssueId && (
        <Modal title="Send to" color="blue" onClose={() => { setDelegateIssueId(null); setDelegateTargetId(""); setDelegateNote(""); }}>
          <p className="font-body text-sm text-ops-muted mb-4">Send this problem to someone on site.</p>
          <FieldSelect value={delegateTargetId} onChange={setDelegateTargetId}>
            <option value="">Select person</option>
            {delegateCandidates.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
            ))}
          </FieldSelect>
          <textarea
            value={delegateNote}
            onChange={(e) => setDelegateNote(e.target.value)}
            placeholder="Instructions (optional)"
            rows={3}
            className="w-full mt-3 bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA] text-sm"
          />
          <Button className="w-full mt-4" size="lg" disabled={delegateBusy || !delegateTargetId} onClick={handleDelegate}>
            {delegateBusy ? "Sending..." : "Send"}
          </Button>
        </Modal>
      )}

      {mechanicIssueId && (
        <Modal title="Send to mechanic" color="blue" onClose={() => { setMechanicIssueId(null); setMechanicTargetId(""); setMechanicNote(""); }}>
          <FieldSelect value={mechanicTargetId} onChange={setMechanicTargetId}>
            <option value="">Select mechanic</option>
            {mechanicCandidates.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </FieldSelect>
          <textarea
            value={mechanicNote}
            onChange={(e) => setMechanicNote(e.target.value)}
            placeholder="What should they look at?"
            rows={3}
            className="w-full mt-3 bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA] text-sm"
          />
          <Button className="w-full mt-4" size="lg" disabled={mechanicBusy || !mechanicTargetId} onClick={handleSendToMechanic}>
            {mechanicBusy ? "Sending..." : "Send"}
          </Button>
        </Modal>
      )}

      {reasonModal && (
        <Modal title={reasonModal.title} color="yellow" onClose={() => setReasonModal(null)}>
          <textarea
            value={reasonModal.reason}
            onChange={(e) => setReasonModal({ ...reasonModal, reason: e.target.value })}
            placeholder={reasonModal.placeholder}
            rows={4}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]"
          />
          <Button className="w-full mt-4" size="lg" disabled={!reasonModal.reason.trim()} onClick={handleReasonConfirm}>
            Send back
          </Button>
        </Modal>
      )}

      {(linkedShift || linkedLoading) && (
        <SupervisorVerifySheet
          title={linkedDoc?.title || "Daily report"}
          html={linkedDoc?.html}
          loading={linkedLoading}
          error={linkedError}
          mode={
            !linkedShift?.id || getShiftStatus(linkedShift) === SHIFT.VERIFIED
              ? "filed"
              : needsBerlingtonSign(linkedShift)
                ? "send"
                : "sign"
          }
          signature={signature}
          onSignature={setSignature}
          busy={!!verifyBusy}
          ownerName={berlingtonName}
          onSign={() => handleVerify("machine_sign")}
          onSendBack={() => openReasonModal(linkedShift, "correct")}
          onSendToOwner={() => sendToBerlington(linkedShift)}
          onClose={closeLinkedReport}
          onRetry={() => {
            verifyOpened.current = null;
            setLinkedDoc(null);
            setLinkedError("");
            setVerifyRetry((n) => n + 1);
          }}
        />
      )}

      {editShift && (
        <SupervisorShiftEdit
          shift={editShift}
          user={user}
          site={activeSite}
          siteDispatch={siteDispatch}
          factors={dispatchFactors}
          onClose={() => setEditShift(null)}
          onDone={async (updated) => {
            await refreshLocal();
            const signed = [SHIFT.VERIFIED, SHIFT.MACHINE_SIGNED].includes(getShiftStatus(updated));
            showAlert(
              "Saved",
              signed ? "The report numbers are updated." : "Report updated. Sign it when the numbers are right.",
              "success"
            );
          }}
        />
      )}

      {closeShift && (
        <Modal title="Close shift" color="yellow" onClose={() => setCloseShift(null)}>
          <p className="font-body text-sm text-ops-muted mb-3">
            {closeShift.operator_name || "Operator"} on {machineName(closeShift.machine_id)}
          </p>
          <label className="block">
            <span className="ops-field-label">Closing meter</span>
            <input
              value={closeMeter}
              onChange={(e) => setCloseMeter(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]"
            />
          </label>
          <Button
            className="w-full mt-4"
            size="lg"
            disabled={closeBusy || closeMeter === ""}
            onClick={async () => {
              setCloseBusy(true);
              try {
                const machine = machines.find((m) => m.id === closeShift.machine_id);
                await wf.closeOpenShift(user, machine, closeShift, { endHour: closeMeter });
                await refreshLocal();
                setCloseShift(null);
                showAlert("Shift closed", "It is waiting for sign-off.", "success");
              } catch (e) {
                showAlert("Could not close", e.message, "error");
              } finally {
                setCloseBusy(false);
              }
            }}
          >
            {closeBusy ? "Closing..." : "Close shift"}
          </Button>
        </Modal>
      )}

      {justSigned && (
        <Modal title={`Send to ${berlingtonName}`} color="green" onClose={() => setJustSigned(null)}>
          <SiteSignShareCard
            shift={shifts.find((s) => s.id === justSigned.id) || justSigned}
            machineName={machineName(justSigned.machine_id)}
            ownerName={berlingtonName}
            sending={resendBusy === justSigned.id}
            onView={() => handleViewReport(shifts.find((s) => s.id === justSigned.id) || justSigned)}
            onSend={() => sendToBerlington(justSigned)}
            onDismiss={() => setJustSigned(null)}
          />
        </Modal>
      )}

      {showBucketSize && (
        <Modal title="Bucket size" color="yellow" onClose={() => setShowBucketSize(false)}>
          <BucketSizeEditor
            siteId={user?.site_id || activeSite?.id}
            settings={siteConfig}
            onSaved={async () => { await syncNow(); await refreshLocal(); setShowBucketSize(false); }}
            showAlert={showAlert}
          />
        </Modal>
      )}

      <KpiDetailModal detail={kpiDetail} onClose={() => setKpiDetail(null)} />

      {reportPreview && (
        <ReportPreviewModal
          html={reportPreview.html}
          title={reportPreview.title}
          sheets={reportPreview.sheets}
          startShareOpen={reportPreview.startShareOpen}
          onClose={() => setReportPreview(null)}
        />
      )}
    </AppPage>
  );
}

function ShiftProductionLines({ shift, dispatches, siteConfig }) {
  const production = productionForShift(shift, dispatches, siteConfig);
  if (!production) return null;
  const { tonnes_screened: screened, tonnes_on_floor: floor, excavator_buckets: excavatorBuckets, fel_buckets: felBuckets } = production;
  if (screened == null && floor == null && excavatorBuckets == null && felBuckets == null) return null;
  const tonnes = (n) => (n == null ? "—" : `${Number(n).toLocaleString("en-US")} t`);
  return (
    <div className="mt-3 space-y-1">
      <p className="font-ui text-2xl font-semibold text-[#22C55E]">{tonnes(screened)}</p>
      <p className="font-body text-xs text-ops-muted">Material screened{excavatorBuckets == null ? "" : ` · ${excavatorBuckets} excavator buckets`}</p>
      <p className="font-ui text-2xl font-semibold text-[#F97316] mt-2">{tonnes(floor)}</p>
      <p className="font-body text-xs text-ops-muted">On the floor{felBuckets == null ? "" : ` · ${felBuckets} FEL buckets`}</p>
    </div>
  );
}

function reportDayLabel(iso) {
  const key = localDayKey(iso);
  if (!key) return "Undated";
  const today = localDayKey();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  if (key === today) return "Today";
  if (key === localDayKey(yesterdayDate)) return "Yesterday";
  return new Date(`${key}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

function reportStatus(shift, ownerName) {
  const status = getShiftStatus(shift);
  if (status === SHIFT.CORRECTION_REQUIRED) return { label: "Sent back", tone: "text-[#F97316]" };
  if ([SHIFT.WAITING_FOR_VERIFICATION, SHIFT.RESUBMITTED, SHIFT.SUBMITTED].includes(status)) {
    return { label: "Waiting for you", tone: "text-[#F5C518]" };
  }
  if (needsBerlingtonSign(shift)) return { label: `Send to ${ownerName}`, tone: "text-[#25D366]" };
  if (status === SHIFT.VERIFIED || status === SHIFT.MACHINE_SIGNED) return { label: "Signed", tone: "text-[#22C55E]" };
  return { label: "Report", tone: "text-ops-muted" };
}

function DailyReportsByDate({
  shifts = [],
  periodLabel,
  berlingtonName,
  machineName,
  verifyBusy,
  resendBusy,
  siteConfig,
  siteDispatch,
  onOpen,
  onSendBack,
  onView,
  onSend,
  onEdit,
}) {
  const days = [];
  for (const shift of shifts) {
    const key = localDayKey(shift.started_at || shift.ended_at || shift.verified_at) || "undated";
    const last = days[days.length - 1];
    if (last?.key === key) last.rows.push(shift);
    else days.push({ key, label: reportDayLabel(shift.started_at || shift.ended_at || shift.verified_at), rows: [shift] });
  }

  if (!days.length) {
    return <p className="font-body text-sm text-ops-muted">No reports for {periodLabel}.</p>;
  }

  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section key={day.key} className="space-y-2">
          <p className="font-ui text-sm font-semibold text-[#F5C518]">{day.label}</p>
          {day.rows.map((row) => {
            const status = reportStatus(row, berlingtonName);
            const waiting = status.label === "Waiting for you";
            const sending = status.label.startsWith("Send to");
            return (
              <div key={row.id} className="bg-ops-card border border-ops-border rounded-2xl p-4">
                <p className="font-ui font-semibold text-ops-text">{machineName(row.machine_id)}</p>
                <p className="font-body text-sm text-ops-muted mt-1">
                  {row.operator_name || "Operator"} · {Number(row.hours_worked || 0).toFixed(1)}h
                </p>
                <p className={`font-ui text-sm font-semibold mt-1 ${status.tone}`}>{status.label}</p>
                <ShiftProductionLines shift={row} dispatches={siteDispatch} siteConfig={siteConfig} />
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {waiting && (
                    <Button className="w-full" size="lg" disabled={verifyBusy === row.id} onClick={() => onOpen(row)}>
                      Open and sign
                    </Button>
                  )}
                  {waiting && (
                    <Button className="w-full" size="lg" variant="secondary" disabled={verifyBusy === row.id} onClick={() => onSendBack(row)}>
                      Send back
                    </Button>
                  )}
                  {sending && (
                    <Button className="w-full" variant="whatsapp" disabled={resendBusy === row.id} onClick={() => onSend(row)}>
                      {resendBusy === row.id ? "Opening..." : `WhatsApp ${berlingtonName}`}
                    </Button>
                  )}
                  {!waiting && (
                    <Button className="w-full" size="lg" variant="secondary" onClick={() => onView(row)}>
                      Open report
                    </Button>
                  )}
                  <Button className="w-full" size="lg" variant="secondary" onClick={() => onEdit(row)}>
                    Edit
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function SiteSignShareCard({ shift, machineName, ownerName = "Berlington", onDismiss, onSend, onView, sending, compact }) {
  const expiry = shift?.site_token_expires_at ? new Date(shift.site_token_expires_at).toLocaleDateString() : "";
  return (
    <div className={compact ? "bg-[#141414] border border-[#25D366]/40 rounded-xl p-4" : ""}>
      <p className="font-ui text-sm font-semibold text-[#25D366] mb-1">
        {compact ? `Signed by you` : `WhatsApp this report to ${ownerName}`}
      </p>
      <p className="text-base text-[#F2F0EA]">
        {machineName} · {shift?.operator_name || "Operator"} · {Number(shift?.hours_worked || 0).toFixed(1)}h
      </p>
      <p className="text-sm text-[#F2F0EA]/50 mt-1">{fmtDateShort(shift?.ended_at || shift?.started_at)}</p>
      <p className="text-sm text-[#F2F0EA]/60 mt-1">
        Signed by {shift?.machine_signature_name || shift?.supervisor_signature_name || "you"}
        {expiry ? ` - link expires ${expiry}` : ""}
      </p>
      <Button className="w-full mt-3" variant="whatsapp" disabled={sending} onClick={onSend}>
        {sending ? "Opening..." : `WhatsApp ${ownerName}`}
      </Button>
      {onView && (
        <Button className="w-full mt-2" variant="secondary" onClick={onView}>
          Open signed copy
        </Button>
      )}
      {onDismiss && (
        <Button className="w-full mt-2" variant="ghost" onClick={onDismiss}>
          Done
        </Button>
      )}
    </div>
  );
}

function lineStatus(fleet) {
  if (!fleet) {
    return { label: "Off site", color: "#F2F0EA", sub: "No machine", wash: "rgba(242,240,234,0.06)", border: "rgba(242,240,234,0.2)" };
  }
  if (fleet.isStopped) {
    return {
      label: "Stopped",
      color: "#EF4444",
      sub: fleet.openStop?.reason || fleet.runningShift?.operator_name || "Stopped",
      wash: "rgba(239,68,68,0.14)",
      border: "rgba(239,68,68,0.55)",
    };
  }
  if (fleet.isRunning) {
    return {
      label: "Running",
      color: "#22C55E",
      sub: fleet.runningShift?.operator_name || "Running",
      wash: "rgba(34,197,94,0.14)",
      border: "rgba(34,197,94,0.55)",
    };
  }
  if (fleet.activeSession) {
    return {
      label: "Idle",
      color: "#F5C518",
      sub: fleet.activeSession.operator_name || "On site",
      wash: "rgba(245,197,24,0.12)",
      border: "rgba(245,197,24,0.45)",
    };
  }
  return {
    label: "Idle",
    color: "#F2F0EA",
    sub: "Nothing running",
    wash: "rgba(242,240,234,0.06)",
    border: "rgba(242,240,234,0.2)",
  };
}

function LineStatusCard({ line, onOpen }) {
  const status = lineStatus(line.fleet);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-2xl p-3 text-left border min-h-[96px]"
      style={{ background: status.wash, borderColor: status.border }}
    >
      <p className="font-ui text-xs font-semibold text-[#F2F0EA]/70">{line.label}</p>
      <p className="font-ui text-lg font-semibold mt-1" style={{ color: status.color }}>{status.label}</p>
      <p className="font-body text-xs text-[#F2F0EA]/55 mt-1 truncate">{status.sub}</p>
    </button>
  );
}
