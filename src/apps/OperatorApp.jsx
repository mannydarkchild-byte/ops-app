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
import { ISSUE, SHIFT, MECHANICAL_STOP_REASONS, EARLY_CLOCK_OUT_REASONS } from "../lib/constants.js";
import { stopReasonLabels } from "../lib/stopReasons.js";
import { RolePulse } from "../components/RolePulse.jsx";
import { hasCompletedPrestart, getSiteSupervisors, suggestSupervisor, shiftBelongsToWorkSession, stopReasonToIssueArea, getShiftStatus, sameOperatorId } from "../lib/utils.js";
import { prestartItemsForMachine } from "../lib/siteConfig.js";
import { rememberUsualOperator, usualOperatorName } from "../lib/shiftPeople.js";
import { OperatorMachineBoard } from "../components/OperatorMachineBoard.jsx";
import { ShiftCorrectionPanel } from "../components/ShiftCorrectionPanel.jsx";
import { shiftDowntimeMinutes, formatDurationMinutes, formatDurationSeconds, shiftBillableHours } from "../lib/shiftMetrics.js";
import { SupervisorPicker, SupervisorWhatsAppButtons } from "../components/SupervisorPicker.jsx";
import * as wf from "../services/workflows.js";
import { ReportIssueModal } from "../components/ReportIssueModal.jsx";
import { FuelModal } from "../components/FuelModal.jsx";
import { IssueInboxModal } from "../components/IssueInboxModal.jsx";
import { OperatorReportsModal, reportBucket } from "../components/OperatorReportsModal.jsx";
import { OperatorWelcome } from "../components/OperatorWelcome.jsx";
import { OperatorDayTools } from "../components/OperatorDayTools.jsx";
import { OperatorShiftTools } from "../components/OperatorShiftTools.jsx";
import { FieldSelect } from "../components/ui/FieldSelect.jsx";

export function OperatorApp() {
  const {
    user, activeSite, machines, workSession, events,
    shifts, profiles, issues, issueMessages, inspections, workSessions, fuelLogs, hourReadings, refreshLocal, syncNow,
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

  const [stopReason, setStopReason] = useState("");
  const [stopNote, setStopNote] = useState("");
  const [restartNote, setRestartNote] = useState("");
  const [startPhotoError, setStartPhotoError] = useState(false);
  const [endPhotoError, setEndPhotoError] = useState(false);

  const [submittedShift, setSubmittedShift] = useState(null);
  const [clockedOutAfterSubmit, setClockedOutAfterSubmit] = useState(false);
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);
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

  const stopReasons = useMemo(() => stopReasonLabels(siteConfig), [siteConfig]);

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

  const otherOpenShifts = useMemo(
    () => myOpenShifts.filter((s) => !sessionShift || s.id !== sessionShift.id),
    [myOpenShifts, sessionShift]
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

  const operatorTabs = useMemo(() => [
    { id: "diesel", label: "Diesel" },
    { id: "inbox", label: "Inbox", badge: inboxCount },
    { id: "issues", label: "Problem" },
    { id: "pulse", label: "Pulse" },
  ], [inboxCount]);

  const operatorTab = showFuel ? "diesel" : sheet === "inbox" ? "inbox" : showReportIssue ? "issues" : sheet === "pulse" ? "pulse" : "";

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
    && !sameOperatorId(machineRunForWork.operator_id, user?.id)
    ? machineRunForWork
    : null;
  const blocked = !!blockedByOther && !sessionShift && !sessionDowntime;
  const staleOwnShift = machineRunForWork
    && !sessionShift
    && sameOperatorId(machineRunForWork.operator_id, user?.id)
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
      showAlert("Pre-start complete", "Photo the hour meter, then tap Start machine.", "success");
    } catch (e) { showAlert("Incomplete", e.message, "warning"); }
  };

  const handleStart = async () => {
    if (actionBusy) return;
    const name = cabName.trim();
    if (!name) {
      showAlert("Operator name", "Enter the name of the person in the cab.", "warning");
      return;
    }
    if (!startPhotoRef) {
      setStartPhotoError(true);
      showAlert("Photo required", "Take a photo of the hour meter before starting.", "warning");
      return;
    }
    const openHere = (shifts || []).find((s) =>
      s.machine_id === workMachine?.id
      && getShiftStatus(s) === SHIFT.RUNNING
    );
    if (openHere) {
      const mine = sameOperatorId(openHere.operator_id, user?.id);
      showAlert(
        "Already running",
        mine
          ? `${workMachine?.name || "This machine"} already has an open shift. Finish that one before starting another.`
          : `${openHere.operator_name || "Someone else"} already has an open shift on ${workMachine?.name || "this machine"}. A supervisor must close it first.`,
        "warning"
      );
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
      if (result?.alreadyRunning) {
        showAlert("Already running", `${workMachine?.name || "This machine"} already has an open shift. Finish that one before starting another.`, "warning");
      } else {
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
      const reportableStops = [...MECHANICAL_STOP_REASONS, "No diesel", "Strike", "Waiting for material", "Waiting for loader", "Weather"];
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

  const handleEndDay = async (clockOutAfter = true) => {
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
      setPickedMachineId("");
      let didClockOut = false;
      const others = myOpenShifts.filter((s) => s.id !== sessionShift?.id);
      if (clockOutAfter && !others.length && workSession) {
        try {
          await wf.clockOut(user, workSession, { note: "Clocked out with shift" });
          didClockOut = true;
        } catch (clockErr) {
          setClockedOutAfterSubmit(false);
          setSubmittedShift(ended);
          await refreshLocal();
          if (navigator.onLine) await syncNow();
          showAlert("Shift sent", `Clock out failed: ${clockErr.message}. Tap Clock out below.`, "warning");
          return;
        }
      }
      setClockedOutAfterSubmit(didClockOut);
      setSubmittedShift(ended);
      await refreshLocal();
      if (navigator.onLine) await syncNow();
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

  const dismissSubmitted = () => {
    setSubmittedShift(null);
    setClockedOutAfterSubmit(false);
  };

  const handleClockOutAfterShift = async () => {
    if (!workSession) return;
    await wf.clockOut(user, workSession, { note: "Clocked out after shift sent" });
    setPickedMachineId("");
    await refreshLocal();
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
    setShowClockOutConfirm(true);
  };

  const confirmClockOut = async () => {
    if (actionBusy) return;
    setActionBusy("clockout");
    try {
      await handleClockOutAfterShift();
      setShowClockOutConfirm(false);
      if (submittedShift) setClockedOutAfterSubmit(true);
    } catch (e) {
      showAlert("Could not clock out", e.message, "error");
    } finally {
      setActionBusy("");
    }
  };

  const machineStatus = sessionShift && sessionDowntime ? "stopped" : sessionShift ? "running" : null;
  const machineFab = submittedShift || showWelcome || sheet || correctionShift
    ? null
    : sessionShift && sessionDowntime
      ? "restart"
      : sessionShift
        ? "stop"
        : machineRunForWork
          ? null
          : workSession && prestartDone && !blocked
            ? "start"
            : null;

  return (
    <AppPage
      subtitle="Operator"
      showSite={false}
      maxWidth="max-w-2xl"
      outdoor
      openHeaderTools
      tabs={operatorTabs}
      activeTab={operatorTab}
      onTabChange={(id) => {
        if (id === "diesel") setShowFuel(true);
        if (id === "inbox") setSheet("inbox");
        if (id === "issues") setShowReportIssue(true);
        if (id === "pulse") setSheet("pulse");
      }}
      alert={<AlertModal {...alert} confirmText="OK" />}
      banner={
        correctionShift && !submittedShift ? (
          <div className="bg-[#F97316]/15 border-b border-[#F97316]/40 px-4 py-3">
            <p className="font-ui text-sm font-semibold text-[#F97316] text-center">
              Supervisor sent a shift back — fix it below, or clock in to start a new one.
            </p>
          </div>
        ) : blocked && !submittedShift && !correctionShift ? (
          <div className="bg-[#EF4444]/10 border-b border-[#EF4444]/30 px-4 py-2.5">
            <p className="font-ui text-sm font-semibold text-[#EF4444] text-center">
              {blockedByOther.operator_name} is running {workMachine?.name}
            </p>
          </div>
        ) : null
      }
    >
        {workSession && (
          <div className="operator-time-bar mb-4">
            <div className="min-w-0">
              <p className="font-ui text-sm font-semibold text-[#F5C518]">On site</p>
              <p className="font-body text-sm text-ops-text truncate">
                Since {new Date(workSession.clock_in).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <Button type="button" variant="secondary" size="md" onClick={handleClockOutTap}>
              <IconLeave /> Clock out
            </Button>
          </div>
        )}

        {showWelcome && (
          <OperatorWelcome
            name={user?.name}
            siteName={activeSite?.name}
            reportsAttention={reportsAttention}
            onReady={startDay}
            onMyReports={() => setSheet("reports")}
            onPulse={() => setSheet("pulse")}
          />
        )}

        {!showWelcome && (
          <>
            <OperatorDayTools
              className="mb-4"
              onPulse={() => setSheet("pulse")}
              onReports={() => setSheet("reports")}
              reportsAttention={reportsAttention}
            />
            {!submittedShift && <OperatorFlowGuide currentStep={currentStep} />}
          </>
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
            <p className="font-ui font-semibold text-[#EF4444] mb-2">A shift was left open</p>
            <p className="font-body text-[#F2F0EA]/75 mb-3">
              Close it before that machine can start again.
            </p>
            {leftoverOpen.map((shift) => (
              <div key={shift.id} className="mb-3 last:mb-0">
                <p className="font-ui font-semibold text-[#F2F0EA] mb-1">
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
          <div className={`bg-[#141414] border-2 rounded-2xl p-5 ${
            getShiftStatus(submittedShift) === SHIFT.RESUBMITTED ? "border-[#F97316]" : "border-[#22C55E]"
          }`}>
            <h2 className={`font-ui text-2xl font-semibold mb-2 ${
              getShiftStatus(submittedShift) === SHIFT.RESUBMITTED ? "text-[#F97316]" : "text-[#22C55E]"
            }`}>
              {getShiftStatus(submittedShift) === SHIFT.RESUBMITTED ? "Sent back to supervisor" : "Shift sent"}
            </h2>
            <p className="font-body text-sm text-ops-text mb-1">
              Machine hours: {Number(submittedShift.hours_worked || 0).toFixed(1)}h ({submittedShift.start_hour_meter}h → {submittedShift.end_hour_meter}h)
            </p>
            <p className="font-body text-sm text-ops-text mb-1">
              Billable hours: {shiftBillableHours(submittedShift, events, siteConfig).toFixed(1)}h
            </p>
            {(submittedShift.runtime_minutes > 0 || submittedShift.downtime_minutes > 0) && (
              <p className="font-body text-sm text-ops-muted mb-1">
                Runtime {formatDurationMinutes(submittedShift.runtime_minutes || 0)} · Downtime {formatDurationMinutes(submittedShift.downtime_minutes || 0)}
              </p>
            )}
            <p className="font-body text-sm text-ops-muted mb-4">
              {getShiftStatus(submittedShift) === SHIFT.RESUBMITTED
                ? "Waiting for supervisor to sign off."
                : `Waiting for ${submittedShift.assigned_supervisor_name || "supervisor"} to sign this machine off.`}
              {clockedOutAfterSubmit
                ? " You are clocked out."
                : workSession
                  ? " You are still on site."
                  : ""}
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
            {clockedOutAfterSubmit || !workSession ? (
              <Button type="button" variant="primary" size="lg" className="w-full mt-3 min-h-14 text-lg" onClick={dismissSubmitted}>
                Done
              </Button>
            ) : (
              <>
                <Button type="button" variant="primary" size="lg" className="w-full mt-3 min-h-14 text-lg" onClick={() => setShowClockOutConfirm(true)}>
                  <IconLeave /> Clock out
                </Button>
                <Button type="button" variant="secondary" size="lg" className="w-full mt-2" onClick={dismissSubmitted}>
                  Next machine
                </Button>
              </>
            )}
          </div>
        )}

        {!workSession && !showWelcome && (
          <div className="operator-work-panel rounded-2xl border border-ops-border bg-ops-card p-4 sm:p-5">
            <p className="operator-group-explain">Starts your time. Does not start a machine.</p>
            <SupervisorPicker
              supervisors={siteSupervisors}
              value={clockInSupervisorId}
              onChange={setClockInSupervisorId}
              suggestedId={suggestedSupervisor?.id}
              label="Supervisor"
            />
            <Button type="button" variant="primary" size="lg" className="w-full min-h-14 text-lg mt-4" onClick={handleClockIn} disabled={!!actionBusy || !clockInSupervisorId}>
              <IconClock /> {actionBusy === "clockin" ? "Clocking in…" : "Clock in"}
            </Button>
          </div>
        )}

        {workSession && !showWelcome && !submittedShift && (
          <OperatorMachineBoard
            machines={siteMachines}
            shifts={shifts}
            events={events}
            user={user}
            workSession={workSession}
            inspections={inspections}
            siteConfig={siteConfig}
            value={pickedMachineId}
            onPick={setPickedMachineId}
          />
        )}

        {workMachine && !submittedShift && !showWelcome && (
          <div className="operator-work-panel rounded-2xl border border-ops-border bg-ops-card p-4 sm:p-5">
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
              <p className="font-body text-base text-ops-red mb-2">
                {blockedByOther.operator_name} already has {workMachine.name} running. Pick another machine above.
              </p>
            )}

            {workSession && !blocked && !staleOwnShift && !prestartDone && !sessionShift && !sessionDowntime && (
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
                    area: "",
                    description: remark ? `${item} — ${remark}` : item,
                    priority: "High",
                  });
                  setShowReportIssue(true);
                }}
              />
            )}

            {workSession && !blocked && !staleOwnShift && prestartDone && !sessionShift && !sessionDowntime && (
              <div className="operator-group">
                <p className="operator-group-explain">Name the operator, photo the hour meter, then start.</p>
                <label className="block mb-4">
                  <span className="ops-field-label">Operator in the cab</span>
                  <input
                    value={cabName}
                    onChange={(e) => setCabName(e.target.value)}
                    onBlur={() => rememberUsualOperator(workMachine.id, cabName)}
                    placeholder="Name on the report"
                    className="w-full bg-ops-black border-2 border-ops-border p-4 rounded-xl text-ops-text text-lg"
                  />
                </label>
                <label className="block mb-4">
                  <span className="ops-field-label">Opening hour meter</span>
                  <p className="font-body text-sm text-ops-muted mb-2">Last signed-off reading: {machineHourMeter}h</p>
                  <MeterPhoto
                    value={startHour}
                    onValue={setStartHour}
                    photo={startPhotoPreview}
                    onPhoto={(ref, preview) => { setStartPhotoRef(ref); setStartPhotoPreview(preview); setStartPhotoError(false); }}
                    showPhotoError={startPhotoError}
                  />
                </label>
                {machineFab === "start" && (
                  <Button type="button" variant="primary" size="lg" className="w-full min-h-14 text-lg" onClick={handleStart} disabled={actionBusy === "start"}>
                    <IconPlay /> {actionBusy === "start" ? "Starting…" : "Start machine"}
                  </Button>
                )}
              </div>
            )}

            {sessionShift && !sessionDowntime && (
              <div className="operator-group">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-ops-black rounded-xl p-4 text-center border border-ops-border">
                    <p className="font-ui text-sm text-ops-muted">Opening meter</p>
                    <p className="font-ui text-3xl font-bold text-ops-gold mt-1">{openingMeter}h</p>
                  </div>
                  <div className="bg-ops-black rounded-xl p-4 text-center border border-ops-border">
                    <p className="font-ui text-sm text-ops-muted">Time running</p>
                    <p className="font-ui text-3xl font-bold text-ops-green mt-1">{formatDurationSeconds(runningSeconds)}</p>
                  </div>
                </div>
                {shiftDowntimeMin > 0 && (
                  <p className="font-body text-sm text-ops-muted mb-3">Downtime this shift: {formatDurationMinutes(shiftDowntimeMin)}</p>
                )}
                <Button type="button" variant="stop" size="lg" className="w-full min-h-14 text-lg" onClick={() => setShowStop(true)}>
                  <IconStop /> Stop machine
                </Button>
                <Button type="button" variant="secondary" size="lg" className="w-full mt-2" onClick={openEndDay}>
                  Finish this shift
                </Button>
              </div>
            )}

            {sessionShift && sessionDowntime && (
              <div className="operator-group">
                <p className="font-ui text-3xl font-bold text-ops-text mb-4 text-center">{formatDurationSeconds(downtimeSeconds)} down</p>
                <Button type="button" variant="primary" size="lg" className="w-full min-h-14 text-lg" onClick={() => setShowRestart(true)}>
                  <IconPlay /> Restart machine
                </Button>
                <Button type="button" variant="secondary" size="lg" className="w-full mt-2" onClick={openEndDay}>
                  Finish this shift
                </Button>
              </div>
            )}

          </div>
        )}

      {sheet === "pulse" && <RolePulse onClose={() => setSheet(null)} />}

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
            <Button type="button" variant="secondary" size="lg" className="w-full" onClick={() => setSuggestReport(null)}>Not now</Button>
            <Button type="button" variant="stop" size="lg" className="w-full" onClick={() => { setReportPrefill({ ...suggestReport, priority: "High" }); setSuggestReport(null); setShowReportIssue(true); }}>
              Report a problem
            </Button>
          </div>
        </Modal>
      )}
      {showFuel && (
        <FuelModal onClose={() => setShowFuel(false)} currentMeter={fuelMeterHint} user={user} machine={workMachine || siteMachines[0]} machines={siteMachines} shifts={shifts} site={activeSite} shiftId={sessionShift?.id} onDone={refreshLocal} />
      )}
      {showEarlyClockOut && (
        <Modal title="Clock out" color="yellow" onClose={() => { setShowEarlyClockOut(false); setEarlyClockOutReason(""); setEarlyClockOutNote(""); }}>
          <label className="block mb-4">
            <span className="ops-field-label">Reason</span>
            <FieldSelect
              value={earlyClockOutReason}
              onChange={setEarlyClockOutReason}
              placeholder="Select reason…"
            >
              {EARLY_CLOCK_OUT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </FieldSelect>
          </label>
          <label className="block mb-4">
            <span className="ops-field-label">Details</span>
            <VoiceInput value={earlyClockOutNote} onChange={setEarlyClockOutNote} placeholder="Optional" rows={2} />
          </label>
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full min-h-14 text-lg"
            onClick={handleEarlyClockOut}
            disabled={!earlyClockOutReason || !!actionBusy}
          >
            {actionBusy === "clockout" ? "Clocking out…" : "Clock out"}
          </Button>
        </Modal>
      )}
      {showStop && (
        <Modal title="Stop machine" color="red" onClose={() => setShowStop(false)}>
          <label className="block mb-4">
            <span className="ops-field-label">Reason</span>
            <FieldSelect
              value={stopReason}
              onChange={setStopReason}
              placeholder="Select reason…"
            >
              {stopReasons.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </FieldSelect>
          </label>
          <label className="block mb-4">
            <span className="ops-field-label">Details</span>
            <VoiceInput value={stopNote} onChange={setStopNote} placeholder="What happened?" rows={2} />
          </label>
          <Button type="button" variant="stop" size="lg" className="w-full min-h-14 text-lg" onClick={handleStop} disabled={!stopReason || !!actionBusy}>
            {actionBusy === "stop" ? "Stopping…" : "Stop machine"}
          </Button>
        </Modal>
      )}
      {showRestart && (
        <Modal title="Restart machine" color="green" onClose={() => setShowRestart(false)}>
          <FormSection title="Action taken" description="What was done to resume work?" accent="#22C55E">
            <VoiceInput value={restartNote} onChange={setRestartNote} placeholder="Action taken…" rows={3} />
          </FormSection>
          <Button type="button" variant="primary" size="lg" className="w-full min-h-14 text-lg" onClick={handleRestart} disabled={!!actionBusy}>
            {actionBusy === "restart" ? "Restarting…" : "Restart machine"}
          </Button>
        </Modal>
      )}
      {showEndDay && (
        <Modal title="Finish shift" color="yellow" onClose={() => setShowEndDay(false)}>
          <p className="font-body text-sm text-ops-muted mb-4">
            {otherOpenShifts.length
              ? "Send this machine for sign-off. Finish the other open machine before you clock out."
              : "Send this machine, then clock out — same as you clocked in."}
          </p>
          <div className="mb-4 px-4 py-3 rounded-xl bg-[#F5C518]/10 border border-[#F5C518]/40">
            <p className="font-ui text-sm font-semibold text-[#F5C518] mb-1">Supervisor</p>
            <p className="font-ui text-base text-ops-text">{shiftSupervisor?.name || "—"}</p>
          </div>
          <FormSection title="Closing hour meter" description="Photo the meter, then type the reading." accent="#F5C518">
            <MeterPhoto
              value={endHour}
              onValue={setEndHour}
              photo={endPhotoPreview}
              onPhoto={(ref, preview) => { setEndPhotoRef(ref); setEndPhotoPreview(preview); setEndPhotoError(false); }}
              showPhotoError={endPhotoError}
            />
          </FormSection>
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full min-h-14 text-lg"
            onClick={() => handleEndDay(!otherOpenShifts.length)}
            disabled={!!actionBusy || !shiftSupervisor?.id || !endHour || !endPhotoRef}
          >
            {actionBusy === "end" ? "Sending…" : otherOpenShifts.length ? "Send this machine’s shift" : "Send and clock out"}
          </Button>
          {!otherOpenShifts.length && (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full mt-2"
              onClick={() => handleEndDay(false)}
              disabled={!!actionBusy || !shiftSupervisor?.id || !endHour || !endPhotoRef}
            >
              Send, stay on site
            </Button>
          )}
        </Modal>
      )}
      {showClockOutConfirm && (
        <Modal title="Clock out" color="yellow" onClose={() => setShowClockOutConfirm(false)}>
          <p className="font-body text-sm text-ops-muted mb-4">Stops your time on site.</p>
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full min-h-14 text-lg"
            onClick={confirmClockOut}
            disabled={!!actionBusy}
          >
            <IconLeave /> {actionBusy === "clockout" ? "Clocking out…" : "Clock out"}
          </Button>
        </Modal>
      )}
    </AppPage>
  );
}
