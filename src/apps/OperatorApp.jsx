import { useEffect, useMemo, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { useLiveTimer } from "../hooks/useLiveTimer.js";
import { useInspectionDraft } from "../hooks/useInspectionDraft.js";
import { prestartDraftKey } from "../lib/inspectionDraft.js";
import { AppPage } from "../components/AppShell.jsx";
import { PreStartInspectionChecklist } from "../components/PreStartInspectionChecklist.jsx";
import { OperatorFlowGuide } from "../components/OperatorFlowGuide.jsx";
import { IconClock, IconLeave, IconPlay, IconStop } from "../components/FieldIcons.jsx";
import { Button } from "../components/ui/Button.jsx";
import { MeterPhoto } from "../components/ui/MeterPhoto.jsx";
import { FormSection } from "../components/ui/FormSection.jsx";
import { Modal, AlertModal } from "../components/ui/Modal.jsx";
import { VoiceInput } from "../components/ui/VoiceInput.jsx";
import { ISSUE, SHIFT, MECHANICAL_STOP_REASONS, EARLY_CLOCK_OUT_REASONS, EARLY_CLOCK_OUT_GUIDE, STOP_REASON_GUIDE } from "../lib/constants.js";
import { stopReasonGroups, ownerForStopReason } from "../lib/stopReasons.js";
import { ProductivityPulseScreen } from "../components/ProductivityPulseScreen.jsx";
import { ChoiceHint, statusGuide } from "../components/ui/ChoiceHint.jsx";
import { hasCompletedPrestart, getSiteSupervisors, suggestSupervisor, shiftBelongsToWorkSession, stopReasonToIssueArea, getShiftStatus } from "../lib/utils.js";
import { prestartItemsForMachine } from "../lib/siteConfig.js";
import { rememberUsualOperator, usualOperatorName } from "../lib/shiftPeople.js";
import { OperatorMachineBoard } from "../components/OperatorMachineBoard.jsx";
import { ShiftCorrectionPanel } from "../components/ShiftCorrectionPanel.jsx";
import { shiftDowntimeMinutes, formatDurationSeconds, shiftBillableHours } from "../lib/shiftMetrics.js";
import { SupervisorPicker, SupervisorWhatsAppButtons } from "../components/SupervisorPicker.jsx";
import * as wf from "../services/workflows.js";
import { ReportIssueModal } from "../components/ReportIssueModal.jsx";
import { FuelModal } from "../components/FuelModal.jsx";
import { IssueInboxModal } from "../components/IssueInboxModal.jsx";
import { OperatorReportsModal, reportBucket } from "../components/OperatorReportsModal.jsx";
import { OperatorWelcome } from "../components/OperatorWelcome.jsx";
import { OperatorShiftTools } from "../components/OperatorShiftTools.jsx";

export function OperatorApp() {
  const {
    user, activeSite, machines, workSession, events,
    shifts, profiles, issues, issueMessages, inspections, workSessions, fuelLogs, hourReadings, refreshLocal,
    getSettingsForSite,
  } = useOps();

  const siteConfig = useMemo(
    () => getSettingsForSite(activeSite?.id),
    [getSettingsForSite, activeSite?.id]
  );

  const [startHour, setStartHour] = useState("");
  const [startPhotoRef, setStartPhotoRef] = useState(null);
  const [startPhotoPreview, setStartPhotoPreview] = useState(null);
  const [endHour, setEndHour] = useState("");
  const [endPhotoRef, setEndPhotoRef] = useState(null);
  const [endPhotoPreview, setEndPhotoPreview] = useState(null);

  const [showStop, setShowStop] = useState(false);
  const [showRestart, setShowRestart] = useState(false);
  const [showEndDay, setShowEndDay] = useState(false);
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [showFuel, setShowFuel] = useState(false);
  const [showEarlyClockOut, setShowEarlyClockOut] = useState(false);
  const [earlyClockOutReason, setEarlyClockOutReason] = useState("");
  const [earlyClockOutNote, setEarlyClockOutNote] = useState("");
  const [suggestReport, setSuggestReport] = useState(null);
  const [reportPrefill, setReportPrefill] = useState(null);
  const [sheet, setSheet] = useState(null);

  const stopGroups = useMemo(() => stopReasonGroups(siteConfig), [siteConfig]);

  const [stopReason, setStopReason] = useState("");
  const [stopNote, setStopNote] = useState("");
  const [restartNote, setRestartNote] = useState("");
  const [startPhotoError, setStartPhotoError] = useState(false);
  const [endPhotoError, setEndPhotoError] = useState(false);

  const [submittedShift, setSubmittedShift] = useState(null);
  const [clockInSupervisorId, setClockInSupervisorId] = useState("");
  const [pickedMachineId, setPickedMachineId] = useState("");
  const [cabName, setCabName] = useState("");
  const [dayReady, setDayReady] = useState(() => {
    try {
      return sessionStorage.getItem(`ops-day-ready:${user?.id || "me"}`) === "1";
    } catch {
      return false;
    }
  });

  const [alert, setAlert] = useState({ isOpen: false });
  const [actionBusy, setActionBusy] = useState("");
  const showAlert = (title, message, type = "info") => setAlert({ isOpen: true, title, message, type, onConfirm: () => setAlert({ isOpen: false }) });

  const siteMachines = useMemo(
    () => (machines || []).filter((m) => m.site_id === activeSite?.id && m.active !== false),
    [machines, activeSite?.id]
  );

  const workMachine = useMemo(
    () => siteMachines.find((m) => m.id === pickedMachineId) || null,
    [siteMachines, pickedMachineId]
  );

  const prestartItems = useMemo(
    () => prestartItemsForMachine(siteConfig, workMachine),
    [siteConfig, workMachine]
  );

  const prestartDone = useMemo(
    () => hasCompletedPrestart(
      inspections, user?.id, workMachine?.id, workSession?.clock_in, prestartItems.length
    ),
    [inspections, user?.id, workMachine?.id, workSession?.clock_in, prestartItems.length]
  );

  const machineRunForWork = useMemo(() => {
    if (!workMachine) return null;
    return shifts.find((s) => s.machine_id === workMachine.id && getShiftStatus(s) === SHIFT.RUNNING) || null;
  }, [shifts, workMachine]);

  /** Shift for this clock-in on the machine they picked. Other machines can stay running. */
  const sessionShift = useMemo(() => {
    if (!machineRunForWork || !workSession || !user?.id) return null;
    return shiftBelongsToWorkSession(machineRunForWork, workSession, user.id) ? machineRunForWork : null;
  }, [machineRunForWork, workSession, user?.id]);

  const machineHourMeter = useMemo(() => {
    if (!workMachine) return 0;
    const verified = shifts.filter((s) =>
      s.machine_id === workMachine.id && getShiftStatus(s) === SHIFT.VERIFIED && s.end_hour_meter != null
    );
    if (!verified.length) return Number(workMachine.start_hour_meter || 0);
    const latest = verified.reduce((a, b) => new Date(b.ended_at || 0) > new Date(a.ended_at || 0) ? b : a);
    return Number(latest.end_hour_meter);
  }, [shifts, workMachine]);

  const myOpenShifts = useMemo(
    () => (shifts || []).filter((s) =>
      workSession && user?.id && shiftBelongsToWorkSession(s, workSession, user.id) && getShiftStatus(s) === SHIFT.RUNNING
    ),
    [shifts, workSession, user?.id]
  );

  const sessionDowntime = useMemo(() => {
    if (!sessionShift) return null;
    return events.find((e) => e.shift_id === sessionShift.id && e.type === "STOP" && e.status === "open") || null;
  }, [events, sessionShift]);

  const runningSeconds = useLiveTimer(sessionShift?.started_at, !!sessionShift);
  const downtimeSeconds = useLiveTimer(sessionDowntime?.stopped_at, !!sessionDowntime);
  const openingMeter = sessionShift
    ? Number(sessionShift.start_hour_meter).toFixed(1)
    : Number(machineHourMeter).toFixed(1);
  const fuelMeterHint = openingMeter;

  const shiftDowntimeMin = useMemo(
    () => (sessionShift ? shiftDowntimeMinutes(events, sessionShift.id) : 0),
    [events, sessionShift]
  );

  const prestartDraftStorageKey = useMemo(
    () => prestartDraftKey(user?.id, workMachine?.id, workSession?.clock_in),
    [user?.id, workMachine?.id, workSession?.clock_in]
  );

  const {
    results: inspectionResults,
    setResults: setInspectionResults,
    remarks: inspectionRemarks,
    setRemarks: setInspectionRemarks,
    photos: inspectionPhotos,
    setPhotos: setInspectionPhotos,
    step: inspectionStep,
    setStep: setInspectionStep,
    clearDraft: clearPrestartDraft,
  } = useInspectionDraft(prestartDraftStorageKey, {
    enabled: !!workSession && !prestartDone,
  });

  const inboxCount = useMemo(() =>
    issues.filter((i) => i.reporter_id === user?.id && i.status !== ISSUE.RESOLVED).length,
    [issues, user?.id]
  );

  const reportsAttention = useMemo(
    () => (shifts || []).filter((s) =>
      s.operator_id === user?.id && ["sent_back", "pending"].includes(reportBucket(s))
    ).length,
    [shifts, user?.id]
  );

  const operatorMenu = useMemo(() => [
    { label: "Pulse", onClick: () => setSheet("pulse") },
    { label: "Reports", onClick: () => setSheet("reports"), badge: reportsAttention },
    { label: "Inbox", onClick: () => setSheet("inbox"), badge: inboxCount },
    { label: "Log diesel", onClick: () => setShowFuel(true) },
    { label: "Report a problem", onClick: () => setShowReportIssue(true) },
  ], [reportsAttention, inboxCount]);

  const leftoverOpen = useMemo(
    () => (shifts || []).filter((s) =>
      s.operator_id === user?.id
      && getShiftStatus(s) === SHIFT.RUNNING
      && (!workSession || !shiftBelongsToWorkSession(s, workSession, user.id))
    ),
    [shifts, user?.id, workSession]
  );

  /** Shift sent back by supervisor — operator must fix and resubmit before starting again */
  const correctionShift = useMemo(() => {
    if (!user?.id) return null;
    return shifts
      .filter((s) => s.operator_id === user.id && getShiftStatus(s) === SHIFT.CORRECTION_REQUIRED)
      .sort((a, b) => new Date(b.updated_at || b.ended_at || 0) - new Date(a.updated_at || a.ended_at || 0))[0] || null;
  }, [shifts, user?.id]);

  const correctionMachine = useMemo(
    () => machines.find((m) => m.id === correctionShift?.machine_id) || workMachine,
    [machines, correctionShift?.machine_id, workMachine]
  );

  const siteSupervisors = useMemo(
    () => getSiteSupervisors(profiles, activeSite?.id),
    [profiles, activeSite?.id]
  );

  const suggestedSupervisor = useMemo(
    () => suggestSupervisor(siteSupervisors, workSession?.clock_in ? new Date(workSession.clock_in) : new Date()),
    [siteSupervisors, workSession?.clock_in]
  );

  const shiftSupervisor = useMemo(() => {
    if (workSession?.assigned_supervisor_id) {
      return siteSupervisors.find((s) => s.id === workSession.assigned_supervisor_id) || {
        id: workSession.assigned_supervisor_id,
        name: workSession.assigned_supervisor_name || "Supervisor",
      };
    }
    // Legacy sessions clocked in before supervisor-at-clock-in
    if (workSession && suggestedSupervisor) return suggestedSupervisor;
    return null;
  }, [workSession, siteSupervisors, suggestedSupervisor]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      if (sessionStorage.getItem(`ops-day-ready:${user.id}`) === "1") setDayReady(true);
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    if (!workSession && suggestedSupervisor?.id && !clockInSupervisorId) {
      setClockInSupervisorId(suggestedSupervisor.id);
    }
  }, [workSession, suggestedSupervisor?.id, clockInSupervisorId]);

  const blockedByOther = machineRunForWork
    && machineRunForWork.operator_id
    && machineRunForWork.operator_id !== user?.id
    ? machineRunForWork
    : null;
  const blocked = !!blockedByOther && !sessionShift && !sessionDowntime;
  const staleOwnShift = machineRunForWork
    && !sessionShift
    && machineRunForWork.operator_id === user?.id
    ? machineRunForWork
    : null;

  const showWelcome = !workSession && !submittedShift && !correctionShift && !dayReady;

  const startDay = () => {
    try {
      sessionStorage.setItem(`ops-day-ready:${user?.id || "me"}`, "1");
    } catch {}
    setDayReady(true);
  };

  useEffect(() => {
    setCabName(usualOperatorName(workMachine?.id));
    setStartHour("");
    setStartPhotoRef(null);
    setStartPhotoPreview(null);
    setStartPhotoError(false);
    setEndHour("");
    setEndPhotoRef(null);
    setEndPhotoPreview(null);
    setEndPhotoError(false);
  }, [workMachine?.id]);

  const currentStep = useMemo(() => {
    if (correctionShift && workMachine?.id === correctionShift.machine_id && !submittedShift) return "correct";
    if (submittedShift && !workMachine) return "end";
    if (!workSession) return "clock";
    if (!workMachine) return "machines";
    if (sessionShift || sessionDowntime) return "run";
    if (prestartDone) return "start";
    return "inspect";
  }, [correctionShift, submittedShift, workMachine, sessionShift, sessionDowntime, workSession, prestartDone]);

  const handleClockIn = async () => {
    if (actionBusy) return;
    const sup = siteSupervisors.find((s) => s.id === clockInSupervisorId) || null;
    if (!sup) {
      showAlert(
        siteSupervisors.length ? "Select a supervisor" : "No supervisor on this site",
        siteSupervisors.length
          ? "Choose who will sign off this shift."
          : "An admin must add a supervisor on this site. Then tap Update so the name appears here.",
        "warning"
      );
      return;
    }
    setActionBusy("clockin");
    try {
      await wf.clockIn(user, siteMachines[0] || null, activeSite, { assignedSupervisor: sup });
      await refreshLocal();
      showAlert("Clocked in", `You are on site. Supervisor: ${sup.name}. Choose a machine.`, "success");
    } catch (e) { showAlert("Could not clock in", e.message, "error"); }
    finally { setActionBusy(""); }
  };

  const handleEarlyClockOut = async () => {
    if (actionBusy) return;
    if (!earlyClockOutReason) {
      showAlert("Reason required", "Select why you are leaving.", "warning");
      return;
    }
    setActionBusy("clockout");
    try {
      await wf.clockOutEarly(user, workSession, workMachine || siteMachines[0] || null, activeSite, {
        reason: earlyClockOutReason,
        note: earlyClockOutNote,
      });
      setShowEarlyClockOut(false);
      setEarlyClockOutReason("");
      setEarlyClockOutNote("");
      setPickedMachineId("");
      clearPrestartDraft();
      await refreshLocal();
      showAlert("Clocked out", "Your time on site was recorded. The machine was not started.", "success");
    } catch (e) {
      showAlert("Could not clock out", e.message, "error");
    } finally { setActionBusy(""); }
  };

  const handleInspection = async () => {
    try {
      await wf.completeInspection(user, workMachine, activeSite, {
        results: inspectionResults, remarks: inspectionRemarks, photos: inspectionPhotos,
      });
      clearPrestartDraft();
      await refreshLocal();
      showAlert("Pre-start complete", "Tap Start machine at the bottom.", "success");
    } catch (e) { showAlert("Incomplete", e.message, "warning"); }
  };

  const handleStart = async () => {
    if (actionBusy) return;
    const name = cabName.trim();
    if (!name) {
      showAlert("Who is in the cab?", "Enter the person operating this machine. Your login is saved separately as the person who recorded the shift.", "warning");
      return;
    }
    if (!startPhotoRef) {
      setStartPhotoError(true);
      showAlert("Photo required", "Take a photo of the hour meter before starting.", "warning");
      return;
    }
    const openHere = (shifts || []).find((s) =>
      s.machine_id === workMachine?.id
      && s.operator_id === user?.id
      && getShiftStatus(s) === SHIFT.RUNNING
    );
    if (openHere) {
      showAlert("Already running", `${workMachine?.name || "This machine"} already has an open shift. Finish that one before starting another.`, "warning");
      return;
    }
    setActionBusy("start");
    try {
      rememberUsualOperator(workMachine.id, name);
      const result = await wf.startMachine(user, workMachine, activeSite, {
        hourMeter: startHour,
        photoRef: startPhotoRef,
        verifiedShifts: shifts.filter((s) => s.machine_id === workMachine?.id),
        workSessionClockIn: workSession?.clock_in,
        machineOperatorName: name,
      });
      setStartHour(""); setStartPhotoRef(null); setStartPhotoPreview(null);
      await refreshLocal();
      if (!result?.alreadyRunning) {
        showAlert("Machine running", `Started from ${startHour}h.`, "success");
      }
    } catch (e) { showAlert("Could not start", e.message, "error"); }
    finally { setActionBusy(""); }
  };

  const handleStop = async () => {
    if (actionBusy) return;
    const reason = stopReason;
    const note = stopNote;
    setActionBusy("stop");
    try {
      await wf.stopMachine(user, workMachine, activeSite, sessionShift, { reason, note });
      setShowStop(false); setStopReason(""); setStopNote("");
      await refreshLocal();
      showAlert("Machine stopped", reason, "info");
      const reportableStops = [...MECHANICAL_STOP_REASONS, "Strike", "Waiting for Material", "Waiting for Loader", "No Diesel", "Weather"];
      if (reportableStops.includes(reason)) {
        setSuggestReport({
          area: stopReasonToIssueArea(reason),
          description: note?.trim() || reason,
        });
      }
    } catch (e) { showAlert("Could not stop", e.message, "error"); }
    finally { setActionBusy(""); }
  };

  const handleRestart = async () => {
    if (actionBusy) return;
    setActionBusy("restart");
    try {
      await wf.restartMachine(user, workMachine, activeSite, sessionShift, sessionDowntime, { note: restartNote });
      setShowRestart(false); setRestartNote("");
      await refreshLocal();
      showAlert("Machine running", "The machine is running again.", "success");
    } catch (e) { showAlert("Could not restart", e.message, "error"); }
    finally { setActionBusy(""); }
  };

  const handleEndDay = async () => {
    if (actionBusy) return;
    const sup = shiftSupervisor;
    if (!sup?.id) {
      showAlert("No supervisor", "This shift has no supervisor. Ask a supervisor or admin.", "warning");
      return;
    }
    if (!endPhotoRef) {
      setEndPhotoError(true);
      showAlert("Photo required", "Take a photo of the closing hour meter.", "warning");
      return;
    }
    setActionBusy("end");
    try {
      const { ended } = await wf.endMachineDay(user, workMachine, activeSite, sessionShift, {
        endHour, photoRef: endPhotoRef, assignedSupervisor: sup,
      });
      setShowEndDay(false);
      setShowRestart(false);
      setShowStop(false);
      setEndHour(""); setEndPhotoRef(null); setEndPhotoPreview(null);
      setSubmittedShift(ended);
      setPickedMachineId("");
      await refreshLocal();
    } catch (e) { showAlert("Could not finish shift", e.message, "error"); }
    finally { setActionBusy(""); }
  };

  const openEndDay = () => {
    if (!shiftSupervisor?.id) {
      showAlert("No Supervisor", "No supervisor was assigned at clock-in. Contact your supervisor or admin.", "warning");
      return;
    }
    setShowEndDay(true);
  };

  const dismissSubmitted = () => setSubmittedShift(null);

  const handleClockOutAfterShift = async () => {
    if (!workSession) return;
    try {
      await wf.clockOut(user, workSession, { note: "Clocked out after shift sent" });
      setPickedMachineId("");
      await refreshLocal();
    } catch (e) {
      showAlert("Could not clock out", e.message, "error");
    }
  };

  const handleClockOutTap = () => {
    if (myOpenShifts.length) {
      const names = myOpenShifts
        .map((s) => siteMachines.find((m) => m.id === s.machine_id)?.name || "A machine")
        .join(", ");
      showAlert(
        "Finish each machine first",
        `${names} still has an open shift. Open that machine and finish the shift, then clock out.`,
        "warning"
      );
      setPickedMachineId("");
      setSubmittedShift(null);
      return;
    }
    const startedAny = (shifts || []).some((s) =>
      s.operator_id === user?.id
      && workSession
      && s.started_at
      && new Date(s.started_at) >= new Date(workSession.clock_in)
    );
    if (!startedAny) {
      setShowEarlyClockOut(true);
      return;
    }
    handleClockOutAfterShift();
  };

  const machineStatus = sessionShift && sessionDowntime ? "stopped" : sessionShift ? "running" : null;
  const machineFab = submittedShift || showWelcome || sheet || correctionShift
    ? null
    : sessionShift && sessionDowntime
      ? "restart"
      : sessionShift
        ? "stop"
        : workSession && prestartDone && !blocked
          ? "start"
          : null;

  return (
    <AppPage
      subtitle="Operator"
      showSite={false}
      maxWidth="max-w-2xl"
      outdoor
      menuItems={operatorMenu}
      alert={<AlertModal {...alert} confirmText="OK" />}
      banner={
        correctionShift && !submittedShift ? (
          <div className="bg-[#F97316]/15 border-b border-[#F97316]/40 px-4 py-3">
            <p className="font-logo text-sm text-[#F97316] text-center">
              Supervisor sent a shift back — fix it below, or clock in to start a new one.
            </p>
          </div>
        ) : blocked && !submittedShift && !correctionShift ? (
          <div className="bg-[#EF4444]/10 border-b border-[#EF4444]/30 px-4 py-2.5">
            <p className="font-logo text-sm text-[#EF4444] text-center">
              {blockedByOther.operator_name} is running {workMachine?.name}
            </p>
          </div>
        ) : null
      }
    >
        {workSession && (
          <div className="operator-time-bar mb-4">
            <div className="min-w-0">
              <p className="font-ui text-xs tracking-wider text-[#F5C518]">YOUR TIME</p>
              <p className="font-body text-sm text-ops-text truncate">
                On site since {new Date(workSession.clock_in).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <button type="button" onClick={handleClockOutTap} className="operator-clock-out font-ui text-sm">
              <IconLeave /> Clock out
            </button>
          </div>
        )}

        {showWelcome && (
          <OperatorWelcome
            name={user?.name}
            siteName={activeSite?.name}
            reportsAttention={reportsAttention}
            onReady={startDay}
            onMyReports={() => setSheet("reports")}
          />
        )}

        {!showWelcome && (
          <OperatorFlowGuide currentStep={currentStep} />
        )}

        {workSession && workMachine && !showWelcome && (
          <button
            type="button"
            onClick={() => setPickedMachineId("")}
            className="mb-4 font-ui text-sm text-[#F5C518] underline underline-offset-2"
          >
            All machines
          </button>
        )}

        {correctionShift && !submittedShift && (
          <ShiftCorrectionPanel
            shift={correctionShift}
            machine={correctionMachine}
            site={activeSite}
            user={user}
            onDone={refreshLocal}
            onResubmitted={(updated) => setSubmittedShift(updated)}
          />
        )}

        {leftoverOpen.length > 0 && !submittedShift && (
          <div className="mb-4 bg-[#1a1212] border border-[#EF4444]/40 rounded-2xl p-4">
            <p className="font-logo text-[#EF4444] mb-2">A shift was left open</p>
            <p className="font-body text-[#F2F0EA]/75 mb-3">
              Close it before that machine can start again. Enter the closing meter and send it for sign-off, or delete it.
            </p>
            {leftoverOpen.map((shift) => (
              <div key={shift.id} className="mb-3 last:mb-0">
                <p className="font-logo text-[#F2F0EA] mb-1">
                  {machines.find((m) => m.id === shift.machine_id)?.name || "Machine"} · {new Date(shift.started_at).toLocaleString("en-ZA")}
                </p>
                <OperatorShiftTools
                  shift={shift}
                  user={user}
                  supervisors={siteSupervisors}
                  onDone={refreshLocal}
                />
              </div>
            ))}
          </div>
        )}


        {/* Day complete — WhatsApp supervisor */}
        {submittedShift && (
          <div className={`bg-[#141414] border-2 rounded-2xl p-6 text-center ${
            getShiftStatus(submittedShift) === SHIFT.RESUBMITTED ? "border-[#F97316]" : "border-[#22C55E]"
          }`}>
            <div className="text-5xl mb-3">{getShiftStatus(submittedShift) === SHIFT.RESUBMITTED ? "↩" : "✅"}</div>
            <h2 className={`font-logo text-2xl tracking-wider mb-2 ${
              getShiftStatus(submittedShift) === SHIFT.RESUBMITTED ? "text-[#F97316]" : "text-[#22C55E]"
            }`}>
              {getShiftStatus(submittedShift) === SHIFT.RESUBMITTED ? "Sent Back to Supervisor" : "Shift Sent"}
            </h2>
            <p className="font-body text-sm text-[#F2F0EA]/70 mb-1">
              Machine hours: {Number(submittedShift.hours_worked || 0).toFixed(1)}h ({submittedShift.start_hour_meter}h → {submittedShift.end_hour_meter}h)
            </p>
            <p className="font-body text-sm text-[#F2F0EA]/70 mb-1">
              Billable hours: {shiftBillableHours(submittedShift, events, siteConfig).toFixed(1)}h (8h shift minus Darkchild downtime)
            </p>
            {(submittedShift.runtime_minutes > 0 || submittedShift.downtime_minutes > 0) && (
              <p className="font-body text-xs text-[#F2F0EA]/45 mb-1">
                Runtime {Math.round(submittedShift.runtime_minutes || 0)}m · Downtime {Math.round(submittedShift.downtime_minutes || 0)}m
              </p>
            )}
            <p className="font-body text-sm text-[#F2F0EA]/60 mb-2">
              {getShiftStatus(submittedShift) === SHIFT.RESUBMITTED
                ? "Waiting for supervisor to sign off."
                : `Waiting for ${submittedShift.assigned_supervisor_name || "supervisor"} to sign this machine off. Choose the next machine below. Clock out when you leave site.`}
            </p>
            <SupervisorWhatsAppButtons
              supervisors={siteSupervisors}
              shift={submittedShift}
              machine={machines.find((m) => m.id === submittedShift.machine_id) || workMachine}
              recordedBy={user?.name}
              site={activeSite}
              events={events}
              siteSettings={siteConfig}
              assignedSupervisorId={submittedShift.assigned_supervisor_id}
            />
            <OperatorShiftTools
              shift={submittedShift}
              user={user}
              supervisors={siteSupervisors}
              onDone={(updated) => {
                if (updated?.removed) setSubmittedShift(null);
                else if (updated) setSubmittedShift(updated);
                refreshLocal();
              }}
            />
            <button type="button" onClick={dismissSubmitted} className="w-full py-2 font-ui text-sm text-ops-muted">
              Done
            </button>
          </div>
        )}

        {!workSession && !showWelcome && (
          <div className="operator-work-panel rounded-3xl border border-ops-border bg-ops-card p-4 sm:p-5">
            <div className="operator-group">
              <p className="operator-group-label font-logo">Clock in</p>
              <p className="operator-group-explain">This starts your time. It does not start a machine.</p>
              <FormSection title="Supervisor on duty" description="Who will sign off the shifts you record today?" accent="#D4A017">
                <SupervisorPicker
                  supervisors={siteSupervisors}
                  value={clockInSupervisorId}
                  onChange={setClockInSupervisorId}
                  suggestedId={suggestedSupervisor?.id}
                />
                {clockInSupervisorId && (
                  <ChoiceHint>
                    This person signs each machine. Clock in starts your time. Then you choose a machine.
                  </ChoiceHint>
                )}
              </FormSection>
              <FormSection title="Ready to work" description="Tap when you are on site." accent="#15803D">
                <Button type="button" variant="primary" size="lg" className="w-full font-logo" onClick={handleClockIn} disabled={!!actionBusy || !clockInSupervisorId}>
                  <IconClock /> {actionBusy === "clockin" ? "Clocking in…" : "Clock in"}
                </Button>
              </FormSection>
            </div>
          </div>
        )}

        {workSession && !workMachine && !showWelcome && (
          <OperatorMachineBoard
            machines={siteMachines}
            shifts={shifts}
            events={events}
            user={user}
            workSession={workSession}
            inspections={inspections}
            siteConfig={siteConfig}
            onPick={setPickedMachineId}
          />
        )}

        {workMachine && !submittedShift && !showWelcome && (
          <div className="operator-work-panel rounded-3xl border border-ops-border bg-ops-card p-4 sm:p-5">
            {machineStatus && (
              <div className={`mb-4 px-4 py-3 rounded-xl border text-center font-ui text-sm font-semibold ${
                machineStatus === "running"
                  ? "bg-ops-green/10 border-ops-green/35 text-ops-green"
                  : "bg-ops-red/10 border-ops-red/35 text-ops-red"
              }`}>
                {machineStatus === "running" ? "Machine running" : `Stopped — ${sessionDowntime?.reason || "downtime"}`}
              </div>
            )}

            {staleOwnShift && (
              <div className="mb-4">
                <p className="font-body text-base text-ops-text mb-3">
                  Your earlier shift on {workMachine.name} is still open. Close it before starting a new one.
                </p>
                <OperatorShiftTools
                  shift={staleOwnShift}
                  user={user}
                  supervisors={siteSupervisors}
                  onDone={refreshLocal}
                />
              </div>
            )}

            {blocked && (
              <p className="font-body text-base text-center text-ops-red">
                {blockedByOther.operator_name} already has {workMachine.name} running. Choose another machine.
              </p>
            )}

            {workSession && !blocked && !staleOwnShift && !sessionShift && !sessionDowntime && (
              <FormSection
                title="Who is in the cab?"
                description="This name is the machine operator on the report. Your login is recorded separately."
                accent="#F5C518"
              >
                <input
                  value={cabName}
                  onChange={(e) => setCabName(e.target.value)}
                  onBlur={() => rememberUsualOperator(workMachine.id, cabName)}
                  placeholder="Name of the person operating the machine"
                  className="w-full bg-ops-black border border-ops-border p-4 rounded-xl text-ops-text text-lg"
                />
              </FormSection>
            )}

            {workSession && !blocked && !staleOwnShift && !prestartDone && !sessionShift && !sessionDowntime && (
              <>
                <PreStartInspectionChecklist
                  items={prestartItems}
                  statusOptions={siteConfig.prestart_status_options}
                  results={inspectionResults} remarks={inspectionRemarks} photos={inspectionPhotos}
                  setResults={setInspectionResults} setRemarks={setInspectionRemarks} setPhotos={setInspectionPhotos}
                  step={inspectionStep}
                  setStep={setInspectionStep}
                  onComplete={handleInspection}
                  onReportProblem={({ item, remark }) => {
                    setReportPrefill({
                      area: "Mechanical",
                      description: remark ? `${item} — ${remark}` : item,
                      priority: "High",
                    });
                    setShowReportIssue(true);
                  }}
                />
              </>
            )}

            {workSession && !blocked && !staleOwnShift && prestartDone && !sessionShift && !sessionDowntime && (
              <div className="operator-group">
                <p className="operator-group-label font-logo">Start machine</p>
                <p className="operator-group-explain">Photo the hour meter, then tap Start machine. You can leave it running and choose another machine.</p>
                <FormSection title="Opening hour meter" description={`Last signed-off reading: ${machineHourMeter}h.`} accent="#15803D">
                  <MeterPhoto
                    value={startHour}
                    onValue={setStartHour}
                    photo={startPhotoPreview}
                    onPhoto={(ref, preview) => { setStartPhotoRef(ref); setStartPhotoPreview(preview); setStartPhotoError(false); }}
                    showPhotoError={startPhotoError}
                  />
                </FormSection>
              </div>
            )}

            {sessionShift && !sessionDowntime && (
              <div className="operator-group">
                <p className="operator-group-label font-logo">Machine running</p>
                <p className="operator-group-explain">Leave it running and choose another machine, or finish this shift when the day on this machine is done.</p>
                <FormSection title="Machine running" description="Your time is already running at the top." accent="#15803D">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-ops-black rounded-xl p-4 text-center border border-ops-border">
                      <p className="font-ui text-xs font-medium text-ops-muted">Opening meter</p>
                      <p className="font-ui text-4xl font-bold text-ops-gold mt-1">{openingMeter}h</p>
                    </div>
                    <div className="bg-ops-black rounded-xl p-4 text-center border border-ops-border">
                      <p className="font-ui text-xs font-medium text-ops-muted">Time running</p>
                      <p className="font-ui text-4xl font-bold text-ops-green mt-1">{formatDurationSeconds(runningSeconds)}</p>
                    </div>
                  </div>
                  {shiftDowntimeMin > 0 && (
                    <p className="font-body text-sm text-ops-muted mb-3 text-center">Downtime this shift: {Math.round(shiftDowntimeMin)} min</p>
                  )}
                  <button type="button" onClick={() => setPickedMachineId("")} className="w-full mb-2 py-3 rounded-xl border border-[#F5C518] text-[#F5C518] font-logo">
                    Choose another machine
                  </button>
                  <button type="button" onClick={openEndDay} className="w-full py-2 font-ui text-sm text-ops-muted underline underline-offset-2">
                    Finish this shift
                  </button>
                </FormSection>
              </div>
            )}

            {sessionShift && sessionDowntime && (
              <div className="operator-group">
                <p className="operator-group-label font-logo">Machine stopped</p>
                <p className="operator-group-explain">You are still on site. Restart the machine, or finish the shift.</p>
                <FormSection title="Machine stopped" description={`Reason: ${sessionDowntime.reason}.`} accent="#B91C1C">
                  <p className="font-ui text-3xl font-bold text-ops-text mb-4 text-center">{Math.floor(downtimeSeconds / 60)} min down</p>
                  <button type="button" onClick={() => setPickedMachineId("")} className="w-full mb-2 py-3 rounded-xl border border-[#F5C518] text-[#F5C518] font-logo">
                    Choose another machine
                  </button>
                  <button type="button" onClick={openEndDay} className="w-full py-2 font-ui text-sm text-ops-muted underline underline-offset-2">
                    Finish this shift
                  </button>
                </FormSection>
              </div>
            )}

          </div>
        )}

      {sheet === "pulse" && <ProductivityPulseScreen onClose={() => setSheet(null)} />}

      {sheet === "reports" && (
        <OperatorReportsModal
          onClose={() => setSheet(null)}
          user={user}
          shifts={shifts}
          workSessions={workSessions}
          machines={machines}
          events={events}
          inspections={inspections}
          fuelLogs={fuelLogs}
          hourReadings={hourReadings}
          profiles={profiles}
          site={activeSite}
          cycleStartDay={siteConfig.billing_cycle_start_day}
          siteSettings={siteConfig}
          onChanged={refreshLocal}
        />
      )}

      {sheet === "inbox" && (
        <IssueInboxModal
          onClose={() => setSheet(null)}
          user={user}
          issues={issues}
          issueMessages={issueMessages}
          onDone={refreshLocal}
          scope="mine"
          machines={siteMachines}
        />
      )}

      {showReportIssue && (
        <ReportIssueModal onClose={() => { setShowReportIssue(false); setReportPrefill(null); }} user={user} machine={workMachine || siteMachines[0]} machines={siteMachines} site={activeSite} profiles={profiles} onDone={refreshLocal}
          initialArea={reportPrefill?.area || ""} initialDescription={reportPrefill?.description || ""} initialPriority={reportPrefill?.priority || "Medium"} />
      )}
      {suggestReport && (
        <Modal title="Report a problem?" color="yellow" onClose={() => setSuggestReport(null)}>
          <p className="text-sm text-[#F2F0EA]/70 mb-4">
            This looks like a mechanical stop. Report it as a problem so the supervisor and mechanic can track it?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setSuggestReport(null)} className="border border-[#2A2A2A] py-3 rounded-xl font-ui text-sm">Not now</button>
            <button type="button" onClick={() => { setReportPrefill({ ...suggestReport, priority: "High" }); setSuggestReport(null); setShowReportIssue(true); }}
              className="bg-[#EF4444] text-white py-3 rounded-xl font-ui font-semibold text-sm">
              Report a problem
            </button>
          </div>
        </Modal>
      )}
      {showFuel && (
        <FuelModal onClose={() => setShowFuel(false)} currentMeter={fuelMeterHint} user={user} machine={workMachine || siteMachines[0]} machines={siteMachines} shifts={shifts} site={activeSite} shiftId={sessionShift?.id} onDone={refreshLocal} />
      )}
      {showEarlyClockOut && (
        <Modal title="Clock out" color="yellow" onClose={() => { setShowEarlyClockOut(false); setEarlyClockOutReason(""); setEarlyClockOutNote(""); }}>
          <FormSection step={1} title="Why are you leaving site?" description="This stops your working time. The machine was not started." accent="#F5C518">
            <select
              value={earlyClockOutReason}
              onChange={(e) => setEarlyClockOutReason(e.target.value)}
              className="w-full bg-[#0A0A0A] border p-4 rounded-xl text-[#F2F0EA] text-lg min-h-[60px]"
            >
              <option value="">Select reason…</option>
              {EARLY_CLOCK_OUT_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
            {earlyClockOutReason && (
              <ChoiceHint>{statusGuide(EARLY_CLOCK_OUT_GUIDE, earlyClockOutReason)}</ChoiceHint>
            )}
          </FormSection>
          <FormSection step={2} title="Details" description="Optional — add context for the supervisor." accent="#F5C518">
            <VoiceInput value={earlyClockOutNote} onChange={setEarlyClockOutNote} placeholder="Details…" rows={2} />
          </FormSection>
          <button
            type="button"
            onClick={handleEarlyClockOut}
            disabled={!earlyClockOutReason || !!actionBusy}
            className="w-full bg-[#F5C518] text-black py-4 rounded-xl font-logo font-bold disabled:opacity-40"
          >
            {actionBusy === "clockout" ? "Clocking out…" : "Clock out"}
          </button>
        </Modal>
      )}
      {showStop && (
        <Modal title="Stop machine" color="red" onClose={() => setShowStop(false)}>
          <FormSection step={1} title="Stop reason" description="Why is the machine stopping? This points downtime to Darkchild or Berlington." accent="#EF4444">
            <select value={stopReason} onChange={(e) => setStopReason(e.target.value)} className="w-full bg-[#0A0A0A] border p-4 rounded-xl text-[#F2F0EA] text-lg min-h-[60px]">
              <option value="">Select reason…</option>
              {stopGroups.map((group) => (
                <optgroup key={group.owner} label={group.hint}>
                  {group.reasons.map((x) => <option key={x} value={x}>{x}</option>)}
                </optgroup>
              ))}
            </select>
            {stopReason && (
              <ChoiceHint>
                {statusGuide(STOP_REASON_GUIDE, stopReason)} Owner: {ownerForStopReason(stopReason, siteConfig)}.
              </ChoiceHint>
            )}
          </FormSection>
          <FormSection step={2} title="Details" description="What happened? What was done?" accent="#EF4444">
            <VoiceInput value={stopNote} onChange={setStopNote} placeholder="Details…" rows={2} />
          </FormSection>
          <button type="button" onClick={handleStop} disabled={!stopReason || !!actionBusy} className="w-full min-h-12 bg-[#EF4444] text-white rounded-xl font-ui font-semibold disabled:opacity-40">{actionBusy === "stop" ? "Stopping…" : "Stop machine"}</button>
        </Modal>
      )}
      {showRestart && (
        <Modal title="Restart machine" color="green" onClose={() => setShowRestart(false)}>
          <FormSection step={1} title="Action taken" description="What was done to fix or resume work?" accent="#22C55E">
            <VoiceInput value={restartNote} onChange={setRestartNote} placeholder="Action taken…" rows={3} />
          </FormSection>
          <button type="button" onClick={handleRestart} disabled={!!actionBusy} className="w-full min-h-12 bg-[#22C55E] text-black rounded-xl font-ui font-semibold disabled:opacity-40">{actionBusy === "restart" ? "Restarting…" : "Restart machine"}</button>
        </Modal>
      )}
      {showEndDay && (
        <Modal title="Finish shift" color="yellow" onClose={() => setShowEndDay(false)}>
          <p className="font-body text-sm text-[#F2F0EA]/70 mb-4">This sends this machine’s shift for sign-off. You stay clocked in so you can record the next machine.</p>
          <div className="mb-4 px-4 py-3 rounded-xl bg-[#F5C518]/10 border border-[#F5C518]/40">
            <p className="font-logo text-[10px] text-[#F5C518] tracking-wider mb-1">SUPERVISOR FOR THIS SHIFT</p>
            <p className="font-logo text-base text-[#F2F0EA]">{shiftSupervisor?.name || "—"}</p>
          </div>
          <FormSection step={1} title="Closing hour meter" description="Photo of the meter is required. Type the reading from the photo." accent="#F5C518">
            <MeterPhoto
              value={endHour}
              onValue={setEndHour}
              photo={endPhotoPreview}
              onPhoto={(ref, preview) => { setEndPhotoRef(ref); setEndPhotoPreview(preview); setEndPhotoError(false); }}
              showPhotoError={endPhotoError}
            />
          </FormSection>
          <button type="button" onClick={handleEndDay} disabled={!!actionBusy || !shiftSupervisor?.id || !endHour || !endPhotoRef}
            className="w-full min-h-12 bg-[#F5C518] text-black rounded-xl font-ui font-semibold disabled:opacity-40">
            {actionBusy === "end" ? "Sending…" : "Send this machine’s shift"}
          </button>
        </Modal>
      )}
      {machineFab && <div className="h-20" aria-hidden="true" />}
      {machineFab === "start" && (
        <button type="button" className="ops-fab ops-fab-start" onClick={handleStart} disabled={actionBusy === "start"}>
          <IconPlay /> {actionBusy === "start" ? "Starting…" : "Start machine"}
        </button>
      )}
      {machineFab === "stop" && (
        <button type="button" className="ops-fab ops-fab-stop" onClick={() => setShowStop(true)}>
          <IconStop /> Stop machine
        </button>
      )}
      {machineFab === "restart" && (
        <button type="button" className="ops-fab ops-fab-start" onClick={() => setShowRestart(true)}>
          <IconPlay /> Restart machine
        </button>
      )}
    </AppPage>
  );
}
