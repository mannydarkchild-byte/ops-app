import { useEffect, useMemo, useRef, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { AppPage } from "../components/AppShell.jsx";
import { IssueInboxModal } from "../components/IssueInboxModal.jsx";
import { ROLES, SHIFT, ISSUE } from "../lib/constants.js";
import { contractorDowntimeMinutes, formatDurationMinutes, shiftBillableHours } from "../lib/shiftMetrics.js";
import { DashboardKpi, KpiDetailModal } from "../components/DashboardKpi.jsx";
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
} from "../lib/utils.js";
import { hydrateOpenShiftsFromServer } from "../lib/machineStatus.js";
import { needsBerlingtonSign, siteSignLink, siteSignShareText, whatsappShareUrl } from "../lib/shiftAgreement.js";
import { openWhatsApp } from "../lib/whatsapp.js";
import { openShiftDailyReport } from "../services/reports.js";
import { RolePulse } from "../components/RolePulse.jsx";
import { WorkHoursPanel } from "../components/WorkHoursPanel.jsx";
import { SupervisorReports } from "../components/SupervisorReports.jsx";
import { dispatchDayReport } from "../lib/dispatchReport.js";
import {
  DISPATCH_STATUS,
  cycleDispatchTargetTonnes,
  dispatchStatus,
  summarizeDispatch,
  tonnesLabel,
} from "../lib/dispatchMetrics.js";
import { pickLineFleet } from "../lib/siteConfig.js";
import * as wf from "../services/workflows.js";
import { Button } from "../components/ui/Button.jsx";
import { FieldSelect } from "../components/ui/FieldSelect.jsx";
import { AlertModal, Modal } from "../components/ui/Modal.jsx";
import { SignaturePad } from "../components/ui/SignaturePad.jsx";
import { ReportIssueModal } from "../components/ReportIssueModal.jsx";
import { ReportPreviewModal } from "../components/ReportPreviewModal.jsx";
import { SupervisorShiftEdit } from "../components/SupervisorShiftEdit.jsx";

const TABS = [
  { id: "issues", label: "Problems" },
  { id: "home", label: "Home" },
  { id: "pulse", label: "Pulse" },
  { id: "reports", label: "Reports" },
];

const REPORT_FILTERS = [
  { id: "cycle", label: "This cycle" },
  { id: "month", label: "This month" },
  { id: "all", label: "All" },
];

const REPORT_GROUPS = [
  { id: "operators", label: "Operators" },
  { id: "dispatch", label: "Dispatch" },
];

export function SupervisorApp({ verifyShiftId = null, verifyToken: _verifyToken = null, onVerifyConsumed }) {
  const {
    shifts, events, issues, issueMessages, workSessions, machines, profiles,
    fuelLogs, expenses, inspections, hourReadings, siteDispatch, activeSite,
    user, refreshLocal, syncNow, getSettingsForSite,
  } = useOps();

  const siteConfig = useMemo(
    () => getSettingsForSite(user?.site_id || activeSite?.id),
    [getSettingsForSite, user?.site_id, activeSite?.id]
  );

  const [tab, setTab] = useState(verifyShiftId ? "reports" : "home");
  const [verifyBusy, setVerifyBusy] = useState(null);
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [verifyScope, setVerifyScope] = useState("mine");
  const [signature, setSignature] = useState(null);
  const [reportFilter, setReportFilter] = useState("cycle");
  const [reportGroup, setReportGroup] = useState("operators");
  const [focusMachineId, setFocusMachineId] = useState("");
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
    const refreshId = setInterval(refreshTick, 15000);
    return () => { cancelled = true; clearInterval(refreshId); };
  }, [user?.id, refreshLocal]);

  const siteMachines = useMemo(
    () => machines.filter((m) => m.site_id === user?.site_id && m.active !== false),
    [machines, user?.site_id]
  );
  const selectedMachine = useMemo(
    () => siteMachines.find((machine) => machine.id === focusMachineId) || siteMachines[0] || null,
    [siteMachines, focusMachineId]
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
    .filter((r) => [SHIFT.WAITING_FOR_VERIFICATION, SHIFT.RESUBMITTED, SHIFT.SUBMITTED].includes(getShiftStatus(r)) && r.site_id === user?.site_id))
    .sort((a, b) => {
      const aMine = a.assigned_supervisor_id === user?.id ? 0 : 1;
      const bMine = b.assigned_supervisor_id === user?.id ? 0 : 1;
      return aMine - bMine || new Date(b.ended_at || 0) - new Date(a.ended_at || 0);
    });

  const awaitingSiteShifts = useMemo(() => dedupeShifts(shifts
    .filter((r) => r.site_id === user?.site_id && needsBerlingtonSign(r)))
    .sort((a, b) => new Date(b.machine_signed_at || b.verified_at || b.updated_at || 0) - new Date(a.machine_signed_at || a.verified_at || a.updated_at || 0)),
  [shifts, user?.site_id]);

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
    if (reportFilter === "cycle") return getBillingPeriod(new Date(), siteConfig.billing_cycle_start_day);
    const preset = getDatePresets(siteConfig.billing_cycle_start_day).find((p) => p.id === reportFilter);
    return preset ? { start: preset.start, end: preset.end, label: preset.label } : getBillingPeriod(new Date(), siteConfig.billing_cycle_start_day);
  }, [reportFilter, siteConfig.billing_cycle_start_day]);

  const signedReports = useMemo(() => (
    dedupeShifts(shifts
      .filter((s) => (
        getShiftStatus(s) === SHIFT.VERIFIED &&
        s.site_id === user?.site_id &&
        s.machine_id === selectedMachine?.id &&
        (s.supervisor_signature_ref || s.supervisor_signature_name || s.machine_signature_ref || s.machine_signature_name || s.verified_at)
      ))
      .filter((s) => !reportPeriod || inPeriod(s.verified_at || s.ended_at, reportPeriod)))
      .sort((a, b) => new Date(b.verified_at || b.ended_at || 0) - new Date(a.verified_at || a.ended_at || 0))
  ), [shifts, user?.site_id, reportPeriod, selectedMachine?.id]);

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
    return {
      cycleTonnes,
      cycleTarget,
      cycleProgress: cycleTarget > 0 ? cycleTonnes / cycleTarget : 0,
      trucksToday,
      trucksCycle: summary.trucks || 0,
      screened: summary.screened,
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

  const verifyOpened = useRef(false);
  useEffect(() => {
    if (!verifyShiftId || verifyOpened.current) return;
    verifyOpened.current = true;
    setTab("reports");
    setReportGroup("operators");
    setVerifyScope("all");
    onVerifyConsumed?.();
  }, [verifyShiftId, onVerifyConsumed]);

  const openVerifyModal = (shift) => {
    setVerifyTarget(shift);
    setSignature(null);
  };

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
      setJustSigned(locked);
      openBerlingtonWhatsApp(locked);
      await refreshLocal();
      setVerifyTarget(null);
      setSignature(null);
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
  const headerContext = `${activeSite?.name || "Site"} - ${billingPeriod.label}`;

  return (
    <AppPage
      subtitle="Supervisor"
      context={headerContext}
      showSite={false}
      tabs={tabItems}
      activeTab={viewTab}
      onTabChange={setTab}
      onSync={syncNow}
      maxWidth="max-w-2xl"
      openHeaderTools
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
                label="Screened"
                value={tonnesLabel(homeKpis.screened)}
                sub="This cycle"
                color="#22C55E"
                onClick={() => setKpiDetail(homeKpis.details?.screened)}
              />
            </div>
            <DashboardKpi
              label="On the floor"
              value={tonnesLabel(homeKpis.floor)}
              sub="Latest closing stock"
              color="#00A4A6"
              onClick={() => setKpiDetail(homeKpis.details?.floor)}
            />
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
        <div className="space-y-4">
          <FieldSelect value={reportGroup} onChange={setReportGroup}>
            {REPORT_GROUPS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </FieldSelect>

          {reportGroup === "operators" && (
            <div className="space-y-4">
              <FieldSelect value={verifyScope} onChange={setVerifyScope}>
                <option value="mine">Assigned to me</option>
                <option value="all">Everyone on site</option>
              </FieldSelect>

              {displayedPendingShifts.length === 0 && awaitingSiteShifts.length === 0 && (
                <p className="font-body text-sm text-ops-muted">No operator reports waiting.</p>
              )}

              {displayedAwaitingCorrection.length > 0 && (
                <p className="font-body text-sm text-[#F5C518]">
                  {displayedAwaitingCorrection.length} sent back for correction
                </p>
              )}

              {displayedPendingShifts.map((r) => (
                <div key={r.id} className="bg-ops-card border-2 border-ops-gold rounded-2xl p-4">
                  <p className="font-ui font-semibold text-ops-text">{machineName(r.machine_id)}</p>
                  <p className="font-body text-sm text-ops-muted mt-1">
                    {r.operator_name || "Operator"} - {Number(r.hours_worked || 0).toFixed(1)}h
                  </p>
                  {(r.runtime_minutes > 0 || r.downtime_minutes > 0) && (
                    <p className="text-sm text-[#F2F0EA]/45">
                      Runtime {formatDurationMinutes(r.runtime_minutes || 0)} - Downtime {formatDurationMinutes(r.downtime_minutes || 0)}
                    </p>
                  )}
                  {r.assigned_supervisor_name && (
                    <p className="text-sm text-[#F5C518]/80 mt-1">
                      {r.assigned_supervisor_id === user?.id ? "Assigned to you" : `Assigned: ${r.assigned_supervisor_name}`}
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-2 mt-4">
                    <Button className="w-full" size="lg" disabled={verifyBusy === r.id} onClick={() => openVerifyModal(r)}>
                      Sign
                    </Button>
                    <Button className="w-full" size="lg" variant="secondary" disabled={verifyBusy === r.id} onClick={() => openReasonModal(r, "correct")}>
                      Send back
                    </Button>
                    <Button className="w-full" size="lg" variant="secondary" onClick={() => handleViewReport(r)}>
                      Open report
                    </Button>
                    <Button className="w-full" size="lg" variant="secondary" onClick={() => setEditShift(r)}>
                      Edit report
                    </Button>
                  </div>
                </div>
              ))}

              {awaitingSiteShifts.length > 0 && (
                <div>
                  <p className="font-ui text-sm font-semibold text-[#25D366] mb-2">Send to {berlingtonName} ({awaitingSiteShifts.length})</p>
                  <div className="space-y-2">
                    {awaitingSiteShifts.map((r) => (
                      <SiteSignShareCard
                        key={r.id}
                        shift={r}
                        machineName={machineName(r.machine_id)}
                        ownerName={berlingtonName}
                        compact
                        sending={resendBusy === r.id}
                        onSend={() => sendToBerlington(r)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <p className="font-ui text-sm font-semibold text-ops-text pt-2">Signed</p>
              <SupervisorReports
                machines={siteMachines}
                machineId={selectedMachine?.id}
                onMachine={setFocusMachineId}
                period={reportPeriod}
                periodLabel={reportPeriod?.label || "All time"}
                filter={reportFilter}
                filters={REPORT_FILTERS}
                onFilter={setReportFilter}
                signedReports={signedReports.filter((s) => !needsBerlingtonSign(s))}
                machineName={machineName}
                events={events}
                siteConfig={siteConfig}
                onView={handleViewReport}
              />
            </div>
          )}

          {reportGroup === "dispatch" && (
            <div className="space-y-4">
              <DispatchSignoffList
                rows={assignedDispatch}
                busyId={dispatchBusy}
                emptyHint="No dispatch day is waiting to sign."
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
        </div>
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

      {verifyTarget && (
        <Modal title="Sign" color="green" onClose={() => { setVerifyTarget(null); setSignature(null); }}>
          <p className="font-body text-sm text-ops-muted mb-3">
            {machineName(verifyTarget.machine_id)} - {verifyTarget.operator_name || "Operator"} - {Number(verifyTarget.hours_worked || 0).toFixed(1)}h
          </p>
          <SignaturePad onChange={setSignature} />
          <Button className="w-full mt-4" size="lg" disabled={verifyBusy || !signature} onClick={() => handleVerify("machine_sign")}>
            {verifyBusy ? "Signing..." : "Sign"}
          </Button>
        </Modal>
      )}

      {editShift && (
        <SupervisorShiftEdit
          shift={editShift}
          user={user}
          onClose={() => setEditShift(null)}
          onDone={async () => {
            await refreshLocal();
            showAlert("Saved", "Report updated. Sign it when you are happy with it.", "success");
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
            onSend={() => sendToBerlington(justSigned)}
            onDismiss={() => setJustSigned(null)}
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

function SiteSignShareCard({ shift, machineName, ownerName = "Berlington", onDismiss, onSend, sending, compact }) {
  const link = shift?.site_token ? siteSignLink(shift) : "";
  const expiry = shift?.site_token_expires_at ? new Date(shift.site_token_expires_at).toLocaleDateString() : "";
  return (
    <div className={compact ? "bg-[#141414] border border-[#25D366]/40 rounded-xl p-4" : ""}>
      <p className="font-ui text-sm font-semibold text-[#25D366] mb-1">
        {compact ? `Needs ${ownerName} sign` : `WhatsApp this report to ${ownerName}`}
      </p>
      <p className="text-base text-[#F2F0EA]">
        {machineName} - {shift?.operator_name || "Operator"} - {Number(shift?.hours_worked || 0).toFixed(1)}h machine
      </p>
      <p className="text-sm text-[#F2F0EA]/60 mt-1">
        Signed by {shift?.machine_signature_name || shift?.supervisor_signature_name || "you"}
        {expiry ? ` - link expires ${expiry}` : ""}
      </p>
      <Button className="w-full mt-3" variant="whatsapp" disabled={sending} onClick={onSend}>
        {sending ? "Opening..." : link ? `WhatsApp ${ownerName}` : `Create link & WhatsApp ${ownerName}`}
      </Button>
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
