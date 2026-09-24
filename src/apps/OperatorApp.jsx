import { useEffect, useMemo, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { useLiveTimer } from "../hooks/useLiveTimer.js";
import { useInspectionDraft } from "../hooks/useInspectionDraft.js";
import { prestartDraftKey } from "../lib/inspectionDraft.js";
import { AppPage } from "../components/AppShell.jsx";
import { PreStartInspectionChecklist } from "../components/PreStartInspectionChecklist.jsx";
import { OperatorFlowGuide } from "../components/OperatorFlowGuide.jsx";
import { IconAlert, IconClock, IconFuel, IconInbox, IconPlay, IconStop } from "../components/FieldIcons.jsx";
import { Button } from "../components/ui/Button.jsx";
import { MeterPhoto } from "../components/ui/MeterPhoto.jsx";
import { FormSection } from "../components/ui/FormSection.jsx";
import { Modal, AlertModal } from "../components/ui/Modal.jsx";
import { VoiceInput } from "../components/ui/VoiceInput.jsx";
import { STOP_REASONS, ISSUE, SHIFT, MECHANICAL_STOP_REASONS, EARLY_CLOCK_OUT_REASONS } from "../lib/constants.js";
import { hasCompletedPrestart, getSiteSupervisors, suggestSupervisor, shiftBelongsToWorkSession, stopReasonToIssueArea, getShiftStatus } from "../lib/utils.js";
import { ShiftCorrectionPanel } from "../components/ShiftCorrectionPanel.jsx";
import { shiftDowntimeMinutes, formatDurationSeconds } from "../lib/shiftMetrics.js";
import { SupervisorPicker, SupervisorWhatsAppButtons } from "../components/SupervisorPicker.jsx";
import * as wf from "../services/workflows.js";
import { ReportIssueModal } from "../components/ReportIssueModal.jsx";
import { FuelModal } from "../components/FuelModal.jsx";
import { IssueInboxModal } from "../components/IssueInboxModal.jsx";

export function OperatorApp() {
  const {
    user, activeMachine, activeSite, machines, machineRun, workSession, downtime, hourMeter, events,
    shifts, profiles, issues, issueMessages, inspections, refreshLocal, machineBlocked,
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
  const [showInbox, setShowInbox] = useState(false);
  const [showEarlyClockOut, setShowEarlyClockOut] = useState(false);
  const [earlyClockOutReason, setEarlyClockOutReason] = useState("");
  const [earlyClockOutNote, setEarlyClockOutNote] = useState("");
  const [suggestReport, setSuggestReport] = useState(null);
  const [reportPrefill, setReportPrefill] = useState(null);

  const [stopReason, setStopReason] = useState("");
  const [stopNote, setStopNote] = useState("");
  const [restartNote, setRestartNote] = useState("");
  const [startPhotoError, setStartPhotoError] = useState(false);
  const [endPhotoError, setEndPhotoError] = useState(false);

  const [submittedShift, setSubmittedShift] = useState(null);
  const [clockInSupervisorId, setClockInSupervisorId] = useState("");

  const [alert, setAlert] = useState({ isOpen: false });
  const showAlert = (title, message, type = "info") => setAlert({ isOpen: true, title, message, type, onConfirm: () => setAlert({ isOpen: false }) });

  const prestartDone = useMemo(
    () => hasCompletedPrestart(
      inspections, user?.id, activeMachine?.id, workSession?.clock_in, siteConfig.prestart_items.length
    ),
    [inspections, user?.id, activeMachine?.id, workSession?.clock_in, siteConfig.prestart_items.length]
  );

  /** Shift for this clock-in only — never skip pre-start for stale or in-progress RUNNING rows */
  const sessionShift = useMemo(() => {
    if (!machineRun || !workSession || !user?.id || !prestartDone) return null;
    return shiftBelongsToWorkSession(machineRun, workSession, user.id) ? machineRun : null;
  }, [machineRun, workSession, user?.id, prestartDone]);

  const sessionDowntime = useMemo(() => {
    if (!sessionShift) return null;
    return events.find((e) => e.shift_id === sessionShift.id && e.type === "STOP" && e.status === "open") || null;
  }, [events, sessionShift]);

  const runningSeconds = useLiveTimer(sessionShift?.started_at, !!sessionShift);
  const downtimeSeconds = useLiveTimer(sessionDowntime?.stopped_at, !!sessionDowntime);
  const openingMeter = sessionShift ? Number(sessionShift.start_hour_meter).toFixed(1) : Number(hourMeter).toFixed(1);
  const fuelMeterHint = sessionShift ? openingMeter : openingMeter;

  const shiftDowntimeMin = useMemo(
    () => (sessionShift ? shiftDowntimeMinutes(events, sessionShift.id) : 0),
    [events, sessionShift]
  );

  const prestartDraftStorageKey = useMemo(
    () => prestartDraftKey(user?.id, activeMachine?.id, workSession?.clock_in),
    [user?.id, activeMachine?.id, workSession?.clock_in]
  );

  const {
    results: inspectionResults,
    setResults: setInspectionResults,
    remarks: inspectionRemarks,
    setRemarks: setInspectionRemarks,
    photos: inspectionPhotos,
    setPhotos: setInspectionPhotos,
    clearDraft: clearPrestartDraft,
  } = useInspectionDraft(prestartDraftStorageKey, {
    enabled: !!workSession && !prestartDone,
  });

  const inboxCount = useMemo(() =>
    issues.filter((i) => i.reporter_id === user?.id && i.status !== ISSUE.RESOLVED).length,
    [issues, user?.id]
  );

  /** Shift sent back by supervisor — operator must fix and resubmit before starting again */
  const correctionShift = useMemo(() => {
    if (!user?.id) return null;
    return shifts
      .filter((s) => s.operator_id === user.id && getShiftStatus(s) === SHIFT.CORRECTION_REQUIRED)
      .sort((a, b) => new Date(b.updated_at || b.ended_at || 0) - new Date(a.updated_at || a.ended_at || 0))[0] || null;
  }, [shifts, user?.id]);

  const correctionMachine = useMemo(
    () => machines.find((m) => m.id === correctionShift?.machine_id) || activeMachine,
    [machines, correctionShift?.machine_id, activeMachine]
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
    if (!workSession && suggestedSupervisor?.id && !clockInSupervisorId) {
      setClockInSupervisorId(suggestedSupervisor.id);
    }
  }, [workSession, suggestedSupervisor?.id, clockInSupervisorId]);

  const blocked = machineBlocked && !sessionShift && !sessionDowntime;

  const currentStep = useMemo(() => {
    if (correctionShift && !submittedShift) return "correct";
    if (submittedShift) return "end";
    if (sessionShift || sessionDowntime) return "run";
    if (workSession && prestartDone) return "start";
    if (workSession) return "inspect";
    return "clock";
  }, [correctionShift, submittedShift, sessionShift, sessionDowntime, workSession, prestartDone]);

  const handleClockIn = async () => {
    if (blocked) {
      showAlert("Machine In Use", `${machineBlocked.operator_name || "Another operator"} is running ${activeMachine?.name}.`, "warning");
      return;
    }
    const sup = siteSupervisors.find((s) => s.id === clockInSupervisorId);
    if (!sup) {
      showAlert("Select Supervisor", "Choose who is supervising your shift before clocking in.", "warning");
      return;
    }
    try {
      await wf.clockIn(user, activeMachine, activeSite, { assignedSupervisor: sup });
      await refreshLocal();
      showAlert("Clocked In", `Welcome ${user.name}! Supervisor: ${sup.name}. Complete pre-start next.`, "success");
    } catch (e) { showAlert("Error", e.message, "error"); }
  };

  const handleEarlyClockOut = async () => {
    if (!earlyClockOutReason) {
      showAlert("Reason required", "Select why you are clocking out without starting.", "warning");
      return;
    }
    try {
      await wf.clockOutEarly(user, workSession, activeMachine, activeSite, {
        reason: earlyClockOutReason,
        note: earlyClockOutNote,
      });
      setShowEarlyClockOut(false);
      setEarlyClockOutReason("");
      setEarlyClockOutNote("");
      clearPrestartDraft();
      await refreshLocal();
      showAlert("Clocked Out", "Your time on site was recorded. No shift was started.", "success");
    } catch (e) {
      showAlert("Could not clock out", e.message, "error");
    }
  };

  const handleInspection = async () => {
    try {
      await wf.completeInspection(user, activeMachine, activeSite, {
        results: inspectionResults, remarks: inspectionRemarks, photos: inspectionPhotos,
      });
      clearPrestartDraft();
      await refreshLocal();
      showAlert("Inspection Complete", "Pre-start saved. Tap Start Machine below.", "success");
    } catch (e) { showAlert("Incomplete", e.message, "warning"); }
  };

  const handleStart = async () => {
    if (!startPhotoRef) {
      setStartPhotoError(true);
      showAlert("Photo Required", "Take a photo of the opening hour meter before starting.", "warning");
      return;
    }
    try {
      await wf.startMachine(user, activeMachine, activeSite, {
        hourMeter: startHour,
        photoRef: startPhotoRef,
        verifiedShifts: shifts.filter((s) => s.machine_id === activeMachine?.id),
        workSessionClockIn: workSession?.clock_in,
      });
      setStartHour(""); setStartPhotoRef(null); setStartPhotoPreview(null);
      await refreshLocal();
      showAlert("Machine Started", `Running from ${startHour}h`, "success");
    } catch (e) { showAlert("Could Not Start", e.message, "error"); }
  };

  const handleStop = async () => {
    const reason = stopReason;
    const note = stopNote;
    try {
      await wf.stopMachine(user, activeMachine, activeSite, sessionShift, { reason, note });
      setShowStop(false); setStopReason(""); setStopNote("");
      await refreshLocal();
      showAlert("Machine Stopped", reason, "info");
      const reportableStops = [...MECHANICAL_STOP_REASONS, "Strike", "Waiting for Material", "Waiting for Loader", "No Diesel", "Weather"];
      if (reportableStops.includes(reason)) {
        setSuggestReport({
          area: stopReasonToIssueArea(reason),
          description: note?.trim() || reason,
        });
      }
    } catch (e) { showAlert("Error", e.message, "error"); }
  };

  const handleRestart = async () => {
    try {
      await wf.restartMachine(user, activeMachine, activeSite, sessionShift, sessionDowntime, { note: restartNote });
      setShowRestart(false); setRestartNote("");
      await refreshLocal();
      showAlert("Restarted", "Machine running again.", "success");
    } catch (e) { showAlert("Error", e.message, "error"); }
  };

  const handleEndDay = async () => {
    const sup = shiftSupervisor;
    if (!sup?.id) {
      showAlert("No Supervisor", "This shift has no supervisor assigned. Clock in again tomorrow with a supervisor selected.", "warning");
      return;
    }
    if (!endPhotoRef) {
      setEndPhotoError(true);
      showAlert("Photo Required", "Take a photo of the closing hour meter before submitting.", "warning");
      return;
    }
    try {
      const { ended } = await wf.endMachineDay(user, activeMachine, activeSite, sessionShift, {
        endHour, photoRef: endPhotoRef, assignedSupervisor: sup,
      });
      if (workSession) await wf.clockOut(user, workSession, { note: "End of machine day" });
      setShowEndDay(false);
      setShowRestart(false);
      setShowStop(false);
      setEndHour(""); setEndPhotoRef(null); setEndPhotoPreview(null);
      setSubmittedShift(ended);
      await refreshLocal();
    } catch (e) { showAlert("Error", e.message, "error"); }
  };

  const openEndDay = () => {
    if (!shiftSupervisor?.id) {
      showAlert("No Supervisor", "No supervisor was assigned at clock-in. Contact your supervisor or admin.", "warning");
      return;
    }
    setShowEndDay(true);
  };

  const dismissSubmitted = () => setSubmittedShift(null);

  const machineStatus = sessionShift ? "running" : sessionDowntime ? "stopped" : null;

  return (
    <AppPage
      subtitle="Operator"
      showSite={false}
      maxWidth="max-w-2xl"
      outdoor
      alert={<AlertModal {...alert} confirmText="OK" />}
      banner={
        correctionShift && !submittedShift ? (
          <div className="bg-[#F97316]/15 border-b border-[#F97316]/40 px-4 py-3">
            <p className="font-logo text-sm text-[#F97316] text-center">
              Supervisor sent your shift back — fix it below before you can clock in again.
            </p>
          </div>
        ) : blocked && !submittedShift && !correctionShift ? (
          <div className="bg-[#EF4444]/10 border-b border-[#EF4444]/30 px-4 py-2.5">
            <p className="font-logo text-sm text-[#EF4444] text-center">
              {machineBlocked.operator_name} is running {activeMachine?.name}
            </p>
          </div>
        ) : null
      }
    >
        {workSession && !submittedShift && !correctionShift && (
          <div className="operator-pin-icons grid grid-cols-3 gap-3 mb-4">
            <button type="button" onClick={() => setShowReportIssue(true)} className="flex flex-col items-center gap-1.5 py-2">
              <span className="w-16 h-16 rounded-2xl bg-[#1a1212] border border-[#EF4444]/40 text-[#EF4444] flex items-center justify-center"><IconAlert /></span>
              <span className="font-logo text-xs text-[#F2F0EA]">Report</span>
            </button>
            <button type="button" onClick={() => setShowFuel(true)} className="flex flex-col items-center gap-1.5 py-2">
              <span className="w-16 h-16 rounded-2xl bg-[#141414] border border-[#F5C518]/50 text-[#F5C518] flex items-center justify-center"><IconFuel /></span>
              <span className="font-logo text-xs text-[#F2F0EA]">Diesel</span>
            </button>
            <button type="button" onClick={() => setShowInbox(true)} className="relative flex flex-col items-center gap-1.5 py-2">
              <span className="w-16 h-16 rounded-2xl bg-[#141414] border border-[#00A4A6]/50 text-[#00A4A6] flex items-center justify-center"><IconInbox /></span>
              <span className="font-logo text-xs text-[#F2F0EA]">Inbox</span>
              {inboxCount > 0 && (
                <span className="absolute top-1 right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center">{inboxCount}</span>
              )}
            </button>
          </div>
        )}

        {!correctionShift && !submittedShift && (
          <OperatorFlowGuide currentStep={currentStep} />
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
              Meter hours: {Number(submittedShift.hours_worked || 0).toFixed(1)}h ({submittedShift.start_hour_meter}h → {submittedShift.end_hour_meter}h)
            </p>
            {(submittedShift.runtime_minutes > 0 || submittedShift.downtime_minutes > 0) && (
              <p className="font-body text-xs text-[#F2F0EA]/45 mb-1">
                Runtime {Math.round(submittedShift.runtime_minutes || 0)}m · Downtime {Math.round(submittedShift.downtime_minutes || 0)}m
              </p>
            )}
            <p className="font-body text-sm text-[#F2F0EA]/60 mb-4">
              {getShiftStatus(submittedShift) === SHIFT.RESUBMITTED
                ? "Waiting for supervisor to sign off."
                : `Waiting for ${submittedShift.assigned_supervisor_name || "supervisor"} to sign off.`}
            </p>
            <SupervisorWhatsAppButtons
              supervisors={siteSupervisors}
              shift={submittedShift}
              machine={activeMachine}
              site={activeSite}
              assignedSupervisorId={submittedShift.assigned_supervisor_id}
            />
            <button type="button" onClick={dismissSubmitted} className="w-full border border-[#2A2A2A] text-[#F2F0EA]/50 py-3 rounded-xl font-logo text-xs">
              DONE
            </button>
          </div>
        )}

        {!submittedShift && !correctionShift && (
          <div className="operator-work-panel rounded-3xl border border-ops-border bg-ops-card p-4 sm:p-5">
            {machineStatus && (
              <div className={`mb-4 px-4 py-3 rounded-xl border text-center font-ui text-sm font-semibold ${
                machineStatus === "running"
                  ? "bg-ops-green/10 border-ops-green/35 text-ops-green"
                  : "bg-ops-red/10 border-ops-red/35 text-ops-red"
              }`}>
                {machineStatus === "running" ? "Machine running" : `Stopped — ${downtime?.reason || "downtime"}`}
              </div>
            )}

            {!workSession && (
              <>
                <FormSection title="Supervisor on duty" description="Who will sign off your shift today?" accent="#D4A017">
                  <SupervisorPicker
                    supervisors={siteSupervisors}
                    value={clockInSupervisorId}
                    onChange={setClockInSupervisorId}
                    suggestedId={suggestedSupervisor?.id}
                  />
                </FormSection>
                <FormSection title="Clock in" description="Tap when you are on site and ready." accent="#15803D">
                  <Button type="button" variant="primary" size="lg" className="w-full font-logo" onClick={handleClockIn} disabled={blocked || !clockInSupervisorId}>
                    <IconClock /> Clock in
                  </Button>
                </FormSection>
              </>
            )}

            {workSession && !prestartDone && !sessionShift && !sessionDowntime && (
              <>
                <PreStartInspectionChecklist
                  items={siteConfig.prestart_items}
                  statusOptions={siteConfig.prestart_status_options}
                  results={inspectionResults} remarks={inspectionRemarks} photos={inspectionPhotos}
                  setResults={setInspectionResults} setRemarks={setInspectionRemarks} setPhotos={setInspectionPhotos}
                  onComplete={handleInspection}
                />
                <Button type="button" variant="ghost" size="md" className="w-full mt-4" onClick={() => setShowEarlyClockOut(true)}>
                  Clock out — not starting today
                </Button>
              </>
            )}

            {workSession && prestartDone && !sessionShift && !sessionDowntime && (
              <>
                <FormSection title="Opening hour meter" description={`Take a photo of the meter. Last verified reading: ${hourMeter}h.`} accent="#15803D">
                  <MeterPhoto
                    value={startHour}
                    onValue={setStartHour}
                    photo={startPhotoPreview}
                    onPhoto={(ref, preview) => { setStartPhotoRef(ref); setStartPhotoPreview(preview); setStartPhotoError(false); }}
                    showPhotoError={startPhotoError}
                  />
                  <Button type="button" variant="primary" size="lg" className="w-full mt-4 font-logo" onClick={handleStart}>
                    <IconPlay /> Start machine
                  </Button>
                </FormSection>
                <Button type="button" variant="ghost" size="md" className="w-full mt-4" onClick={() => setShowEarlyClockOut(true)}>
                  Clock out — not starting today
                </Button>
              </>
            )}

            {sessionShift && !sessionDowntime && (
              <FormSection title="Your shift" description="Billable hours come from the closing meter at end of day." accent="#15803D">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-ops-black rounded-xl p-4 text-center border border-ops-border">
                    <p className="font-ui text-xs font-medium text-ops-muted">Opening meter</p>
                    <p className="font-ui text-3xl font-bold text-ops-gold mt-1">{openingMeter}h</p>
                  </div>
                  <div className="bg-ops-black rounded-xl p-4 text-center border border-ops-border">
                    <p className="font-ui text-xs font-medium text-ops-muted">Runtime (app)</p>
                    <p className="font-ui text-3xl font-bold text-ops-green mt-1">{formatDurationSeconds(runningSeconds)}</p>
                  </div>
                </div>
                {shiftDowntimeMin > 0 && (
                  <p className="font-body text-sm text-ops-muted mb-3 text-center">Downtime this shift: {Math.round(shiftDowntimeMin)} min</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Button type="button" variant="danger" size="lg" className="font-logo" onClick={() => setShowStop(true)}><IconStop /> Stop</Button>
                  <Button type="button" variant="primary" size="lg" className="font-logo" onClick={openEndDay}>End day</Button>
                </div>
              </FormSection>
            )}

            {sessionShift && sessionDowntime && (
              <FormSection title="Machine stopped" description={`Reason: ${sessionDowntime.reason}. Restart when ready, or end day if finished.`} accent="#B91C1C">
                <p className="font-ui text-3xl font-bold text-ops-text mb-4 text-center">{Math.floor(downtimeSeconds / 60)} min down</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button type="button" variant="teal" size="lg" onClick={() => setShowRestart(true)}>Restart</Button>
                  <Button type="button" variant="primary" size="lg" onClick={openEndDay}>End day</Button>
                </div>
              </FormSection>
            )}

          </div>
        )}

      {showReportIssue && (
        <ReportIssueModal onClose={() => { setShowReportIssue(false); setReportPrefill(null); }} user={user} machine={activeMachine} site={activeSite} profiles={profiles} onDone={refreshLocal}
          initialArea={reportPrefill?.area || ""} initialDescription={reportPrefill?.description || ""} initialPriority={reportPrefill?.priority || "Medium"} />
      )}
      {suggestReport && (
        <Modal title="REPORT PROBLEM?" color="yellow" onClose={() => setSuggestReport(null)}>
          <p className="text-sm text-[#F2F0EA]/70 mb-4">
            This looks like a mechanical stop. Report it as a problem so the supervisor and mechanic can track it?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setSuggestReport(null)} className="border border-[#2A2A2A] py-3 rounded-xl font-logo text-sm">NOT NOW</button>
            <button type="button" onClick={() => { setReportPrefill({ ...suggestReport, priority: "High" }); setSuggestReport(null); setShowReportIssue(true); }}
              className="bg-[#EF4444] text-white py-3 rounded-xl font-logo font-bold text-sm">
              REPORT PROBLEM
            </button>
          </div>
        </Modal>
      )}
      {showFuel && (
        <FuelModal onClose={() => setShowFuel(false)} currentMeter={fuelMeterHint} user={user} machine={activeMachine} site={activeSite} shiftId={sessionShift?.id} onDone={refreshLocal} />
      )}
      {showInbox && (
        <IssueInboxModal onClose={() => setShowInbox(false)} user={user} issues={issues} issueMessages={issueMessages} onDone={refreshLocal} scope="mine" machines={activeMachine ? [activeMachine] : []} />
      )}
      {showEarlyClockOut && (
        <Modal title="CLOCK OUT" color="yellow" onClose={() => { setShowEarlyClockOut(false); setEarlyClockOutReason(""); setEarlyClockOutNote(""); }}>
          <FormSection step={1} title="Why are you leaving?" description="You clocked in but are not starting a shift. This is recorded for the supervisor." accent="#F5C518">
            <select
              value={earlyClockOutReason}
              onChange={(e) => setEarlyClockOutReason(e.target.value)}
              className="w-full bg-[#0A0A0A] border p-3 rounded text-[#F2F0EA]"
            >
              <option value="">Select reason…</option>
              {EARLY_CLOCK_OUT_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </FormSection>
          <FormSection step={2} title="Details" description="Optional — add context for the supervisor." accent="#F5C518">
            <VoiceInput value={earlyClockOutNote} onChange={setEarlyClockOutNote} placeholder="Details…" rows={2} />
          </FormSection>
          <button
            type="button"
            onClick={handleEarlyClockOut}
            disabled={!earlyClockOutReason}
            className="w-full bg-[#F5C518] text-black py-4 rounded-xl font-logo font-bold disabled:opacity-40"
          >
            CONFIRM CLOCK OUT
          </button>
        </Modal>
      )}
      {showStop && (
        <Modal title="STOP MACHINE" color="red" onClose={() => setShowStop(false)}>
          <FormSection step={1} title="Stop reason" description="Why is the machine stopping?" accent="#EF4444">
            <select value={stopReason} onChange={(e) => setStopReason(e.target.value)} className="w-full bg-[#0A0A0A] border p-3 rounded text-[#F2F0EA]">
              <option value="">Select reason…</option>
              {STOP_REASONS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </FormSection>
          <FormSection step={2} title="Details" description="What happened? What was done?" accent="#EF4444">
            <VoiceInput value={stopNote} onChange={setStopNote} placeholder="Details…" rows={2} />
          </FormSection>
          <button type="button" onClick={handleStop} disabled={!stopReason} className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-logo font-bold disabled:opacity-40">CONFIRM STOP</button>
        </Modal>
      )}
      {showRestart && (
        <Modal title="RESTART MACHINE" color="green" onClose={() => setShowRestart(false)}>
          <FormSection step={1} title="Action taken" description="What was done to fix or resume work?" accent="#22C55E">
            <VoiceInput value={restartNote} onChange={setRestartNote} placeholder="Action taken…" rows={3} />
          </FormSection>
          <button type="button" onClick={handleRestart} className="w-full bg-[#22C55E] text-black py-4 rounded-xl font-logo font-bold">RESTART MACHINE</button>
        </Modal>
      )}
      {showEndDay && (
        <Modal title="END DAY — SUBMIT SHIFT" color="yellow" onClose={() => setShowEndDay(false)}>
          <div className="mb-4 px-4 py-3 rounded-xl bg-[#F5C518]/10 border border-[#F5C518]/40">
            <p className="font-logo text-[10px] text-[#F5C518] tracking-wider mb-1">SUPERVISOR FOR THIS SHIFT</p>
            <p className="font-logo text-base text-[#F2F0EA]">{shiftSupervisor?.name || "—"}</p>
          </div>
          <FormSection step={1} title="Closing hour meter" description="Photo of meter is mandatory. Enter reading from the photo." accent="#F5C518">
            <MeterPhoto
              value={endHour}
              onValue={setEndHour}
              photo={endPhotoPreview}
              onPhoto={(ref, preview) => { setEndPhotoRef(ref); setEndPhotoPreview(preview); setEndPhotoError(false); }}
              showPhotoError={endPhotoError}
            />
          </FormSection>
          <button type="button" onClick={handleEndDay} disabled={!shiftSupervisor?.id || !endHour || !endPhotoRef}
            className="w-full bg-[#F5C518] text-black py-4 rounded-xl font-logo font-bold text-base disabled:opacity-40">
            SUBMIT & CLOCK OUT
          </button>
        </Modal>
      )}
    </AppPage>
  );
}
