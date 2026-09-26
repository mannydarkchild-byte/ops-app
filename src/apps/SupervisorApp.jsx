import { useEffect, useMemo, useRef, useState } from "react";

import { useOps } from "../context/OpsContext.jsx";

import { useLiveTimer } from "../hooks/useLiveTimer.js";

import { AppPage } from "../components/AppShell.jsx";

import { ActivityFeed } from "../components/ActivityFeed.jsx";

import { SignedReportCard } from "../components/SignedReportCard.jsx";

import { IssueInboxModal } from "../components/IssueInboxModal.jsx";

import { ROLES, SHIFT, ISSUE } from "../lib/constants.js";

import { formatDurationMinutes } from "../lib/shiftMetrics.js";

import { fmtDateShort, getBillingPeriod, getDatePresets, getShiftStatus, hoursBetween, inPeriod } from "../lib/utils.js";

import { formatSyncErrorMessage } from "../lib/labels.js";
import { hydrateOpenShiftsFromServer } from "../lib/machineStatus.js";

import { TimesheetPanel } from "../components/TimesheetPanel.jsx";
import { buildTimesheetRows } from "../lib/timesheet.js";
import { openShiftDailyReport, printTimesheetReport } from "../services/reports.js";

import * as wf from "../services/workflows.js";

import { AlertModal, Modal } from "../components/ui/Modal.jsx";

import { SignaturePad } from "../components/ui/SignaturePad.jsx";

import { ReportIssueModal } from "../components/ReportIssueModal.jsx";
import { ReportPreviewModal } from "../components/ReportPreviewModal.jsx";
import { ShiftPhotoFix } from "../components/ShiftPhotoFix.jsx";



const TABS = [

  { id: "live", label: "Live", icon: "📡" },

  { id: "verify", label: "Sign Off", icon: "✅" },

  { id: "reports", label: "Signed Off", icon: "📋" },

  { id: "issues", label: "Problems", icon: "💬" },

];



const REPORT_FILTERS = [

  { id: "cycle", label: "This cycle" },

  { id: "month", label: "This month" },

  { id: "all", label: "All" },

];



export function SupervisorApp({ verifyShiftId = null, verifyToken = null, onVerifyConsumed }) {

  const { shifts, events, issues, issueMessages, workSessions, machines, profiles, fuelLogs, inspections, hourReadings, activeSite, user, refreshLocal, syncNow, syncState, getSettingsForSite } = useOps();

  const siteConfig = useMemo(
    () => getSettingsForSite(user?.site_id || activeSite?.id),
    [getSettingsForSite, user?.site_id, activeSite?.id]
  );

  const [tab, setTab] = useState(verifyShiftId ? "verify" : "live");

  const [verifyBusy, setVerifyBusy] = useState(null);

  const [verifyTarget, setVerifyTarget] = useState(null);

  const [verifyScope, setVerifyScope] = useState("mine");

  const [signature, setSignature] = useState(null);

  const [reportFilter, setReportFilter] = useState("cycle");
  const [timesheetFilter, setTimesheetFilter] = useState("cycle");

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
  const [reportPreview, setReportPreview] = useState(null);
  const [closeShift, setCloseShift] = useState(null);
  const [closeMeter, setCloseMeter] = useState("");
  const [closeBusy, setCloseBusy] = useState(false);

  const showAlert = (title, message, type = "info") => setAlert({ isOpen: true, title, message, type, onConfirm: () => setAlert({ isOpen: false }) });

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const refreshTick = async () => {
      if (document.visibilityState !== "visible") return;
      if (navigator.onLine) {
        await hydrateOpenShiftsFromServer().catch(() => {});
      }
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



  const siteIssues = useMemo(

    () => issues.filter((i) => i.site_id === user?.site_id),

    [issues, user?.site_id]

  );



  const openSiteIssues = useMemo(

    () => siteIssues.filter((i) => i.status !== ISSUE.RESOLVED),

    [siteIssues]

  );



  const fleetStatus = useMemo(() => siteMachines.map((machine) => {

    const runningShift = shifts.find((s) => s.machine_id === machine.id && getShiftStatus(s) === SHIFT.RUNNING);

    const openStop = events.find((e) => e.machine_id === machine.id && e.type === "STOP" && e.status === "open");

    const activeSession = workSessions.find((s) => s.status === "active" && s.machine_id === machine.id);

    return {

      machine,

      runningShift,

      openStop,

      activeSession,

      isRunning: !!runningShift && !openStop,

      isStopped: !!openStop,

    };

  }), [siteMachines, shifts, events, workSessions]);

  const openShiftsToClose = useMemo(() => {
    const seen = new Set();
    const rows = [];
    for (const shift of shifts) {
      if (getShiftStatus(shift) !== SHIFT.RUNNING) continue;
      if (seen.has(shift.id)) continue;
      seen.add(shift.id);
      rows.push(shift);
    }
    return rows.sort((a, b) => new Date(a.started_at || 0) - new Date(b.started_at || 0));
  }, [shifts]);



  const pendingShifts = shifts

    .filter((r) => [SHIFT.WAITING_FOR_VERIFICATION, SHIFT.RESUBMITTED].includes(getShiftStatus(r)) && r.site_id === user?.site_id)

    .sort((a, b) => {

      const aMine = a.assigned_supervisor_id === user?.id ? 0 : 1;

      const bMine = b.assigned_supervisor_id === user?.id ? 0 : 1;

      return aMine - bMine || new Date(b.ended_at || 0) - new Date(a.ended_at || 0);

    });



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



  const displayedAwaitingCorrection = useMemo(() => {

    if (verifyScope === "all") return awaitingCorrectionShifts;

    return awaitingCorrectionShifts.filter((s) => s.assigned_supervisor_id === user?.id);

  }, [awaitingCorrectionShifts, verifyScope, user?.id]);



  const myPendingVerify = pendingShifts.filter((s) => s.assigned_supervisor_id === user?.id).length;

  const myAwaitingCorrection = awaitingCorrectionShifts.filter((s) => s.assigned_supervisor_id === user?.id).length;

  const criticalIssues = openSiteIssues.filter((i) => i.priority === "Critical").length;

  const stoppedMachines = fleetStatus.filter((f) => f.isStopped).length;



  const reportPeriod = useMemo(() => {

    if (reportFilter === "all") return null;

    if (reportFilter === "cycle") return getBillingPeriod(new Date(), siteConfig.billing_cycle_start_day);

    const preset = getDatePresets(siteConfig.billing_cycle_start_day).find((p) => p.id === reportFilter);

    return preset ? { start: preset.start, end: preset.end, label: preset.label } : getBillingPeriod(new Date(), siteConfig.billing_cycle_start_day);

  }, [reportFilter]);

  const timesheetPeriod = useMemo(() => {
    if (timesheetFilter === "all") return null;
    if (timesheetFilter === "cycle") return getBillingPeriod(new Date(), siteConfig.billing_cycle_start_day);
    const preset = getDatePresets(siteConfig.billing_cycle_start_day).find((p) => p.id === timesheetFilter);
    return preset ? { start: preset.start, end: preset.end, label: preset.label } : getBillingPeriod(new Date(), siteConfig.billing_cycle_start_day);
  }, [timesheetFilter, siteConfig.billing_cycle_start_day]);

  const timesheetRows = useMemo(
    () => buildTimesheetRows(workSessions, { siteId: user?.site_id, period: timesheetPeriod }),
    [workSessions, user?.site_id, timesheetPeriod]
  );



  const signedReports = useMemo(() => {

    return shifts

      .filter((s) =>

        getShiftStatus(s) === SHIFT.VERIFIED &&

        s.site_id === user?.site_id &&

        (s.supervisor_signature_ref || s.supervisor_signature_name || s.verified_at)

      )

      .filter((s) => !reportPeriod || inPeriod(s.verified_at || s.ended_at, reportPeriod))

      .sort((a, b) => new Date(b.verified_at || b.ended_at || 0) - new Date(a.verified_at || a.ended_at || 0));

  }, [shifts, user?.site_id, reportPeriod]);



  const signedHours = useMemo(

    () => signedReports.reduce((sum, s) => sum + Number(s.hours_worked || 0), 0),

    [signedReports]

  );



  const signedRuntimeMin = useMemo(

    () => signedReports.reduce((sum, s) => sum + Number(s.runtime_minutes || 0), 0),

    [signedReports]

  );



  const signedDowntimeMin = useMemo(

    () => signedReports.reduce((sum, s) => sum + Number(s.downtime_minutes || 0), 0),

    [signedReports]

  );



  const billingPeriod = useMemo(
    () => getBillingPeriod(new Date(), siteConfig.billing_cycle_start_day),
    [siteConfig.billing_cycle_start_day]
  );



  const dashboardShifts = useMemo(

    () => shifts.filter(

      (s) => getShiftStatus(s) === SHIFT.VERIFIED && s.site_id === user?.site_id && inPeriod(s.verified_at || s.ended_at, billingPeriod)

    ),

    [shifts, user?.site_id, billingPeriod]

  );



  const dashboardStats = useMemo(() => ({

    hours: dashboardShifts.reduce((sum, s) => sum + Number(s.hours_worked || 0), 0),

    runtimeMin: dashboardShifts.reduce((sum, s) => sum + Number(s.runtime_minutes || 0), 0),

    downtimeMin: dashboardShifts.reduce((sum, s) => sum + Number(s.downtime_minutes || 0), 0),

    reports: dashboardShifts.length,

  }), [dashboardShifts]);



  const machineName = (machineId) => machines.find((m) => m.id === machineId)?.name || machineId;



  const delegateCandidates = useMemo(

    () => (profiles || []).filter(

      (p) => p.site_id === user?.site_id && p.active !== false && [ROLES.OPERATOR, ROLES.MANAGER].includes(p.role)

    ),

    [profiles, user?.site_id]

  );



  const mechanicCandidates = useMemo(

    () => (profiles || []).filter(

      (p) => p.site_id === user?.site_id && p.active !== false && p.role === ROLES.MECHANIC

    ),

    [profiles, user?.site_id]

  );



  const reportContext = useMemo(() => ({

    events, inspections, fuelLogs, site: activeSite, shifts, hourReadings,

  }), [events, inspections, fuelLogs, activeSite, shifts, hourReadings]);



  const handleViewReport = async (shift) => {

    const machine = machines.find((m) => m.id === shift.machine_id);

    try {

      const doc = await openShiftDailyReport(shift, { ...reportContext, machine });
      setReportPreview(doc);

    } catch (e) {

      showAlert("Could not open report", e.message, "error");

    }

  };



  const handleDownloadReport = (shift) => handleViewReport(shift);

  const handleShareReport = (shift) => handleViewReport(shift);



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



  const [linkShiftId] = useState(verifyShiftId);
  const verifyOpened = useRef(false);

  useEffect(() => {
    if (!verifyShiftId || verifyOpened.current) return;
    verifyOpened.current = true;
    setTab("verify");
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

      placeholder: action === "correct" ? "Tell the operator what to fix…" : "Explain the problem…",

    });

  };



  const handleReasonConfirm = async () => {

    const reason = reasonModal?.reason?.trim();

    if (!reason || !reasonModal?.shift) return;

    const { shift, action } = reasonModal;

    setReasonModal(null);

    setVerifyBusy(shift.id);

    try {

      if (navigator.onLine) {

        await wf.verifyShift(shift, user, { action, reason, signatureDataUrl: null });

        await syncNow();

      } else {

        showAlert("Offline", "This action requires connection.", "warning");

        setVerifyBusy(null);

        return;

      }

      await refreshLocal();

      showAlert("Sent Back", action === "correct" ? "Operator will see your note and must fix their shift report before starting again." : "Escalated to manager.", "success");

    } catch (e) {

      showAlert("Failed", e.message, "error");

    }

    setVerifyBusy(null);

  };



  const handleVerify = async (action) => {

    if (!verifyTarget) return;

    if (action !== "verify") {

      openReasonModal(verifyTarget, action);

      return;

    }

    if (!signature) {

      showAlert("Signature Required", "Draw your signature before verifying.", "warning");

      return;

    }



    setVerifyBusy(verifyTarget.id);

    try {

      if (navigator.onLine) {

        await wf.verifyShift(verifyTarget, user, { action, reason: null, signatureDataUrl: signature });

        await syncNow();

      } else {

        showAlert("Offline", "Verification requires connection.", "warning");

        setVerifyBusy(null);

        return;

      }

      await refreshLocal();

      setVerifyTarget(null);

      setSignature(null);

      showAlert("Done", "Shift verified with your signature.", "success");

    } catch (e) {

      showAlert("Failed", e.message, "error");

    }

    setVerifyBusy(null);

  };



  const tabItems = useMemo(
    () => TABS.map((t) => ({
      ...t,
      badge: t.id === "live" ? openShiftsToClose.length : t.id === "verify" ? myPendingVerify : t.id === "issues" ? openSiteIssues.length : 0,
    })),
    [openShiftsToClose.length, myPendingVerify, openSiteIssues.length]
  );

  const beginCloseShift = (shift) => {
    setCloseShift(shift);
    setCloseMeter(String(shift.start_hour_meter ?? ""));
  };

  const headerContext = `${activeSite?.name || "Site"} · ${billingPeriod.label}`;

  return (

    <AppPage
      subtitle="Supervisor"
      context={headerContext}
      showSite={false}
      tabs={tabItems}
      activeTab={tab}
      onTabChange={setTab}
      onSync={syncNow}
      maxWidth="max-w-2xl"
      leaveApp
      alert={<AlertModal {...alert} confirmText="OK" />}
    >

        {(myPendingVerify > 0 || criticalIssues > 0 || stoppedMachines > 0 || openShiftsToClose.length > 0) && (

          <div className="bg-[#1a1212] border border-[#EF4444]/30 rounded-xl px-3 py-2 mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">

            <span className="font-logo text-sm text-[#EF4444]">Needs attention</span>

            {myPendingVerify > 0 && (

              <button type="button" onClick={() => setTab("verify")} className="ops-chip font-logo text-sm text-[#F5C518] hover:underline">

                {myPendingVerify} to sign off

              </button>

            )}

            {criticalIssues > 0 && (

              <button type="button" onClick={() => setTab("issues")} className="ops-chip font-logo text-sm text-[#EF4444] hover:underline">

                {criticalIssues} critical issue{criticalIssues !== 1 ? "s" : ""}

              </button>

            )}

            {openShiftsToClose.length > 0 && (

              <button type="button" onClick={() => setTab("live")} className="ops-chip font-logo text-sm text-[#F5C518] hover:underline">

                {openShiftsToClose.length} open shift{openShiftsToClose.length !== 1 ? "s" : ""} to close

              </button>

            )}

            {stoppedMachines > 0 && (

              <button type="button" onClick={() => setTab("live")} className="ops-chip font-logo text-sm text-[#F97316] hover:underline">

                {stoppedMachines} machine{stoppedMachines !== 1 ? "s" : ""} stopped

              </button>

            )}

          </div>

        )}



        {tab === "live" && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Kpi
              label="On site now"
              value={String(workSessions.filter((s) => s.status === "active" && s.site_id === user?.site_id).length + openShiftsToClose.length)}
              sub="Clocked in or still running"
              color="#F5C518"
            />
            <Kpi label="To sign off" value={String(myPendingVerify)} sub="Tap Sign Off" color="#22C55E" />
          </div>
        )}

        {tab === "reports" && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Kpi label="Signed reports" value={String(signedReports.length)} sub={reportPeriod?.label || "All time"} color="#F2F0EA" />
            <Kpi label="Meter hours" value={`${signedHours.toFixed(1)}h`} sub="Hour meter" color="#22C55E" />
          </div>
        )}



        {tab === "reports" && (

          <div className="flex flex-wrap gap-1 mb-4">

            {REPORT_FILTERS.map((f) => (

              <button

                key={f.id}

                type="button"

                onClick={() => setReportFilter(f.id)}

                className={`ops-chip px-3 py-2 rounded-lg font-logo text-[10px] tracking-wider ${reportFilter === f.id ? "bg-[#F5C518] text-black" : "bg-[#141414] border border-[#2A2A2A] text-[#F2F0EA]/70"}`}

              >

                {f.label}

              </button>

            ))}

          </div>

        )}



        {tab === "live" && (

          <div className="space-y-4">

            {openShiftsToClose.length > 0 && (
              <div className="border-2 border-[#F5C518] bg-[#2a2208] rounded-2xl p-4 space-y-3">
                <p className="font-logo text-xl text-[#F5C518]">Open shifts — close these</p>
                <p className="font-body text-base text-[#F2F0EA]/80">
                  An operator cannot start until a supervisor closes the leftover shift.
                </p>
                {openShiftsToClose.map((shift) => {
                  const machine = machines.find((m) => m.id === shift.machine_id);
                  return (
                    <div key={shift.id} className="bg-[#0A0A0A] rounded-xl p-4">
                      <p className="font-logo text-lg text-[#F2F0EA]">{shift.operator_name || "Operator"}</p>
                      <p className="font-body text-base text-[#F2F0EA]/70 mt-1">
                        {machine?.name || shift.machine_id || "Machine"}
                        {shift.started_at ? ` · started ${new Date(shift.started_at).toLocaleString()}` : ""}
                      </p>
                      <button
                        type="button"
                        onClick={() => beginCloseShift(shift)}
                        className="w-full mt-3 min-h-[72px] bg-[#F5C518] text-black py-4 rounded-xl font-logo text-xl"
                      >
                        Close this shift
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">
              <p className="font-logo text-sm text-[#F5C518] mb-2">Who is clocked in</p>
              {workSessions.filter((s) => s.status === "active" && s.site_id === user?.site_id).length === 0
                && !fleetStatus.some((f) => f.runningShift) ? (
                <p className="font-body text-sm text-[#F2F0EA]/70">No operator is clocked in on this site. Ask them to tap Update on their phone, then tap Update here.</p>
              ) : (
                <ul className="space-y-2">
                  {workSessions.filter((s) => s.status === "active" && s.site_id === user?.site_id).map((s) => (
                    <li key={s.id} className="font-body text-sm text-[#F2F0EA]">
                      {s.operator_name || "Operator"} · clocked in {s.clock_in ? new Date(s.clock_in).toLocaleTimeString() : ""}
                    </li>
                  ))}
                  {fleetStatus.filter((f) => f.runningShift).map((f) => (
                    <li key={f.runningShift.id} className="font-body text-sm text-[#F5C518]">
                      {f.runningShift.operator_name || "Operator"} still has an open shift on {f.machine.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>

              <p className="font-logo text-xl text-[#F2F0EA] mb-3">Machines on this site</p>

              <div className="grid grid-cols-1 gap-3">

                {fleetStatus.length === 0 ? (

                  <p className="text-sm text-[#F2F0EA]/40 col-span-full text-center py-6">No machines on this site.</p>

                ) : fleetStatus.map((f) => (

                  <FleetMachineCard key={f.machine.id} fleet={f} onCloseShift={beginCloseShift} />

                ))}

              </div>

            </div>



            <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4">

              <p className="font-logo text-xl text-[#F2F0EA] mb-3">What happened today</p>

              <ActivityFeed

                events={events}

                fuelLogs={fuelLogs}

                issues={issues}

                machines={machines}

                siteId={user?.site_id}

              />

            </div>

          </div>

        )}



        {tab === "verify" && (

          <div className="space-y-3">

            <div className="flex gap-1 mb-2">

              <button type="button" onClick={() => setVerifyScope("mine")}

                className={`ops-chip px-3 py-2 rounded-lg font-logo text-[10px] tracking-wider ${verifyScope === "mine" ? "bg-[#F5C518] text-black" : "bg-[#141414] border border-[#2A2A2A] text-[#F2F0EA]/70"}`}>

                Assigned to me

              </button>

              <button type="button" onClick={() => setVerifyScope("all")}

                className={`ops-chip px-3 py-2 rounded-lg font-logo text-[10px] tracking-wider ${verifyScope === "all" ? "bg-[#F5C518] text-black" : "bg-[#141414] border border-[#2A2A2A] text-[#F2F0EA]/70"}`}>

                All site

              </button>

            </div>



            {linkShiftId && pendingShifts.some((s) => s.id === linkShiftId) && (

              <div className="bg-[#F5C518]/10 border border-[#F5C518]/30 rounded-xl p-3 mb-2">

                <p className="font-logo text-xs text-[#F5C518]">Opened from operator WhatsApp link — review and sign below.</p>

              </div>

            )}

            {displayedAwaitingCorrection.length > 0 && (

              <div className="mb-4">

                <p className="font-logo text-sm text-[#F97316] mb-2">With operator — fixing ({displayedAwaitingCorrection.length})</p>

                <div className="space-y-2">

                  {displayedAwaitingCorrection.map((r) => (

                    <div key={r.id} className="bg-[#F97316]/5 border border-[#F97316]/40 rounded-xl p-4">

                      <p className="font-logo text-sm text-[#F97316] mb-1">Sent back to operator</p>

                      <p className="text-base text-[#F2F0EA]">{fmtDateShort(r.started_at)} · {r.operator_name} · {machineName(r.machine_id)}</p>

                      <p className="text-sm text-[#F2F0EA]/60 mt-1">

                        Meter: {r.start_hour_meter}h → {r.end_hour_meter}h · {Number(r.hours_worked || 0).toFixed(1)}h billable

                      </p>

                      {r.supervisor_comment && (

                        <p className="text-sm text-[#F2F0EA]/75 mt-2 leading-relaxed">

                          Your note: {r.supervisor_comment}

                        </p>

                      )}

                      <button type="button" onClick={() => handleViewReport(r)} className="w-full mt-3 border border-[#00A4A6] text-[#00A4A6] py-3 rounded-lg font-logo text-sm">

                        VIEW REPORT

                      </button>

                    </div>

                  ))}

                </div>

              </div>

            )}



            <p className="font-logo text-sm text-[#F5C518] mb-2">Needs your sign-off ({displayedPendingShifts.length})</p>



            {displayedPendingShifts.length === 0 ? <p className="text-sm text-[#F2F0EA]/40">No shifts waiting for sign-off{verifyScope === "mine" ? " on your name" : ""}.</p> : displayedPendingShifts.map((r) => (

              <div

                key={r.id}

                className={`bg-[#141414] border rounded-xl p-4 ${

                  getShiftStatus(r) === SHIFT.RESUBMITTED

                    ? "border-[#F97316] bg-[#F97316]/5"

                    : r.id === linkShiftId

                      ? "border-[#F5C518]"

                      : "border-[#2A2A2A]"

                }`}

              >

                {getShiftStatus(r) === SHIFT.RESUBMITTED && (

                  <p className="font-logo text-sm text-[#F97316] mb-2">Operator fixed this — check again</p>

                )}

                <p className="font-logo text-sm">{fmtDateShort(r.started_at)} · {r.operator_name} · {machineName(r.machine_id)}</p>

                <p className="text-[10px] text-[#F2F0EA]/40">

                  Meter: {r.start_hour_meter}h → {r.end_hour_meter}h · <strong>{Number(r.hours_worked || 0).toFixed(1)}h billable</strong>

                </p>

                {(r.runtime_minutes > 0 || r.downtime_minutes > 0) && (

                  <p className="text-[10px] text-[#F2F0EA]/35">Runtime {Math.round(r.runtime_minutes || 0)}m · Downtime {Math.round(r.downtime_minutes || 0)}m</p>

                )}

                {r.assigned_supervisor_name && (

                  <p className="text-[10px] text-[#F5C518]/80 mt-1">

                    {r.assigned_supervisor_id === user?.id ? "Assigned to you" : `Assigned: ${r.assigned_supervisor_name}`}

                  </p>

                )}

                <div className="grid grid-cols-1 gap-2 mt-4">

                  <button onClick={() => openVerifyModal(r)} disabled={verifyBusy === r.id} className="w-full bg-[#22C55E] text-black py-4 rounded-xl font-logo font-bold">Sign off</button>

                  <button onClick={() => openReasonModal(r, "correct")} disabled={verifyBusy === r.id} className="w-full bg-[#F5C518] text-black py-4 rounded-xl font-logo font-bold">Send back</button>

                  <button type="button" onClick={() => handleViewReport(r)} className="w-full border border-[#2A2A2A] text-[#F2F0EA] py-4 rounded-xl font-logo">Open report</button>

                  <ShiftPhotoFix shift={r} user={user} onDone={() => refreshLocal()} />

                </div>

              </div>

            ))}

          </div>

        )}



        {tab === "reports" && (

          <div className="space-y-3">

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

            {signedReports.length === 0 ? (

              <p className="text-sm text-[#F2F0EA]/40 text-center py-8">No signed reports for this period.</p>

            ) : signedReports.map((r) => (

              <SignedReportCard

                key={r.id}

                shift={r}

                machineName={machineName(r.machine_id)}

                onViewReport={handleViewReport}

                onDownloadReport={handleDownloadReport}

                onShareReport={handleShareReport}

              />

            ))}

          </div>

        )}



        {tab === "issues" && (

          <div className="space-y-3">

            <button

              type="button"

              onClick={() => setShowReportIssue(true)}

              className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-logo font-bold"

            >

              Report a problem

            </button>

            <p className="text-[#F2F0EA]/60 text-center">
              Machine faults, strikes, suppliers, staffing — site-wide or per machine.
            </p>

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

        <Modal title="SEND TO…" color="blue" onClose={() => { setDelegateIssueId(null); setDelegateTargetId(""); setDelegateNote(""); }}>

          <p className="text-sm text-[#F2F0EA]/70 mb-4">

            Send this problem to someone on site to action.

          </p>

          <select

            value={delegateTargetId}

            onChange={(e) => setDelegateTargetId(e.target.value)}

            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded mb-3 text-[#F2F0EA]"

          >

            <option value="">Select person…</option>

            {delegateCandidates.map((p) => (

              <option key={p.id} value={p.id}>{p.name} ({p.role})</option>

            ))}

          </select>

          <textarea

            value={delegateNote}

            onChange={(e) => setDelegateNote(e.target.value)}

            placeholder="Instructions (optional)…"

            rows={3}

            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded mb-4 text-[#F2F0EA] text-sm"

          />

          <button

            type="button"

            onClick={handleDelegate}

            disabled={delegateBusy || !delegateTargetId}

            className="w-full bg-[#00A4A6] text-white py-4 rounded-xl font-logo font-bold disabled:opacity-40"

          >

            {delegateBusy ? "SENDING…" : "CONFIRM"}

          </button>

        </Modal>

      )}



      {mechanicIssueId && (

        <Modal title="SEND TO MECHANIC" color="yellow" onClose={() => { setMechanicIssueId(null); setMechanicTargetId(""); setMechanicNote(""); }}>

          <p className="text-sm text-[#F2F0EA]/70 mb-4">

            Create a repair job for the mechanic. They will see it in their app.

          </p>

          <select

            value={mechanicTargetId}

            onChange={(e) => setMechanicTargetId(e.target.value)}

            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded mb-3 text-[#F2F0EA]"

          >

            <option value="">Select mechanic…</option>

            {mechanicCandidates.map((p) => (

              <option key={p.id} value={p.id}>{p.name}</option>

            ))}

          </select>

          <textarea

            value={mechanicNote}

            onChange={(e) => setMechanicNote(e.target.value)}

            placeholder="Instructions for the mechanic (optional)…"

            rows={3}

            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded mb-4 text-[#F2F0EA] text-sm"

          />

          <button

            type="button"

            onClick={handleSendToMechanic}

            disabled={mechanicBusy || !mechanicTargetId}

            className="w-full bg-[#F5C518] text-black py-4 rounded-xl font-logo font-bold disabled:opacity-40"

          >

            {mechanicBusy ? "SENDING…" : "SEND REPAIR JOB"}

          </button>

        </Modal>

      )}



      {reasonModal && (

        <Modal title={reasonModal.title} color="yellow" onClose={() => setReasonModal(null)}>

          <textarea

            value={reasonModal.reason}

            onChange={(e) => setReasonModal((m) => ({ ...m, reason: e.target.value }))}

            placeholder={reasonModal.placeholder}

            rows={4}

            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded mb-4 text-[#F2F0EA] text-sm"

            autoFocus

          />

          <div className="flex gap-3">

            <button type="button" onClick={() => setReasonModal(null)} className="flex-1 border border-[#2A2A2A] py-3 rounded-xl font-logo text-sm">CANCEL</button>

            <button type="button" onClick={handleReasonConfirm} disabled={!reasonModal.reason?.trim() || verifyBusy}

              className="flex-1 bg-[#F5C518] text-black py-3 rounded-xl font-logo font-bold text-sm disabled:opacity-40">

              CONFIRM

            </button>

          </div>

        </Modal>

      )}



      {verifyTarget && (

        <Modal title="Sign Off Shift" color="green" onClose={() => { setVerifyTarget(null); setSignature(null); }}>

          <p className="font-body text-sm text-[#F2F0EA]/70 mb-4">

            {verifyTarget.operator_name} · {Number(verifyTarget.hours_worked || 0).toFixed(1)}h · {verifyTarget.start_hour_meter}h → {verifyTarget.end_hour_meter}h

          </p>

          <SignaturePad onChange={setSignature} />

          <button onClick={() => handleVerify("verify")} disabled={verifyBusy || !signature}

            className="w-full mt-4 bg-[#22C55E] text-black py-4 rounded-xl font-logo font-bold disabled:opacity-40">

            {verifyBusy ? "VERIFYING…" : "VERIFY WITH SIGNATURE"}

          </button>

        </Modal>

      )}

      {closeShift && (
        <Modal title="Close open shift" color="yellow" onClose={() => setCloseShift(null)}>
          <p className="font-body text-sm text-[#F2F0EA]/80 mb-3">
            {closeShift.operator_name || "This operator"} left this shift open
            {closeShift.started_at ? ` (started ${new Date(closeShift.started_at).toLocaleString()})` : ""}.
            Enter the closing meter, then the next operator can start.
          </p>
          <input
            type="number"
            step="0.1"
            value={closeMeter}
            onChange={(e) => setCloseMeter(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA] mb-4"
          />
          <button
            type="button"
            disabled={closeBusy}
            onClick={async () => {
              setCloseBusy(true);
              try {
                const machine = machines.find((m) => m.id === closeShift.machine_id);
                await wf.closeOpenShift(user, machine, closeShift, { endHour: closeMeter });
                setCloseShift(null);
                try { await syncNow(); } catch {}
                await refreshLocal();
                showAlert("Shift closed", `${closeShift.operator_name || "The operator"}'s open shift is closed. It is waiting for sign-off.`, "success");
              } catch (e) {
                showAlert("Could not close", e.message, "error");
              } finally {
                setCloseBusy(false);
              }
            }}
            className="w-full bg-[#F5C518] text-black py-4 rounded-xl font-logo font-bold disabled:opacity-40"
          >
            {closeBusy ? "Closing…" : "Close shift"}
          </button>
        </Modal>
      )}

      {reportPreview && (
        <ReportPreviewModal
          html={reportPreview.html}
          title={reportPreview.title}
          sheets={reportPreview.sheets}
          onClose={() => setReportPreview(null)}
        />
      )}

    </AppPage>

  );

}



function FleetMachineCard({ fleet, onCloseShift }) {

  const { machine, runningShift, openStop, activeSession, isRunning, isStopped } = fleet;

  const runningSeconds = useLiveTimer(runningShift?.started_at, isRunning);

  const downtimeSeconds = useLiveTimer(openStop?.stopped_at, isStopped);



  const statusColor = isStopped ? "#EF4444" : isRunning ? "#22C55E" : "#F2F0EA";

  const statusLabel = isStopped ? "STOPPED" : isRunning ? "RUNNING" : "IDLE";



  return (

    <div className={`bg-[#141414] border rounded-xl p-4 ${isStopped ? "border-[#EF4444]/50 bg-[#2a1616]/40" : "border-[#2A2A2A]"}`}>

      <div className="flex justify-between items-start gap-2 mb-2">

        <p className="font-logo text-sm text-[#F2F0EA]">{machine.name}</p>

        <p className="font-logo text-xs" style={{ color: statusColor }}>{statusLabel}</p>

      </div>

      {isRunning && (

        <p className="text-sm text-[#F2F0EA]/70">

          {Math.floor(runningSeconds / 3600)}h {Math.floor((runningSeconds % 3600) / 60)}m · {runningShift.operator_name}

        </p>

      )}

      {isStopped && (

        <div>

          <p className="font-logo text-sm text-[#EF4444]">{openStop.reason}</p>

          <p className="text-sm text-[#F2F0EA]/70 mt-1">

            {Math.floor(downtimeSeconds / 60)} min · {openStop.operator_name}

          </p>

        </div>

      )}

      {!isRunning && !isStopped && activeSession && (

        <p className="text-sm text-[#F2F0EA]/50">{activeSession.operator_name} on site · {hoursBetween(activeSession.clock_in).toFixed(1)}h</p>

      )}

      {!isRunning && !isStopped && !activeSession && (

        <p className="text-sm text-[#F2F0EA]/40">No active shift</p>

      )}

      {runningShift && (
        <button
          type="button"
          onClick={() => onCloseShift?.(runningShift)}
          className="mt-3 w-full min-h-[64px] bg-[#F5C518] text-black py-3 rounded-xl font-logo text-base"
        >
          Close {runningShift.operator_name || "operator"}&apos;s shift
        </button>
      )}

    </div>

  );

}



function Kpi({ label, value, sub, color }) {

  return (

    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4">

      <p className="font-logo text-[#F2F0EA]/60">{label}</p>

      <p className="font-logo text-3xl mt-1" style={{ color }}>{value}</p>

      <p className="font-body text-[#F2F0EA]/50 mt-1">{sub}</p>

    </div>

  );

}


