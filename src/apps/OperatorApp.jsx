import { useMemo, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { useLiveTimer } from "../hooks/useLiveTimer.js";
import { AppPage } from "../components/AppShell.jsx";
import { PreStartInspectionChecklist } from "../components/PreStartInspectionChecklist.jsx";
import { OperatorActionBar } from "../components/OperatorActionBar.jsx";
import { OperatorStepBar } from "../components/OperatorStepBar.jsx";
import { MeterPhoto } from "../components/ui/MeterPhoto.jsx";
import { FormSection } from "../components/ui/FormSection.jsx";
import { Modal, AlertModal } from "../components/ui/Modal.jsx";
import { VoiceInput } from "../components/ui/VoiceInput.jsx";
import { STOP_REASONS, ISSUE, MECHANICAL_STOP_REASONS, EARLY_CLOCK_OUT_REASONS } from "../lib/constants.js";
import { hasCompletedPrestart, getSiteSupervisors, suggestSupervisor, stopReasonToIssueArea } from "../lib/utils.js";
import { shiftDowntimeMinutes, formatDurationSeconds } from "../lib/shiftMetrics.js";
import { SupervisorPicker, SupervisorWhatsAppButtons } from "../components/SupervisorPicker.jsx";
import * as wf from "../services/workflows.js";
import { ReportIssueModal } from "../components/ReportIssueModal.jsx";
import { FuelModal } from "../components/FuelModal.jsx";
import { IssueInboxModal } from "../components/IssueInboxModal.jsx";

export function OperatorApp() {
  const {
    user, activeMachine, activeSite, machineRun, workSession, downtime, hourMeter, events,
    shifts, profiles, issues, issueMessages, inspections, refreshLocal, machineBlocked,
    getSettingsForSite,
  } = useOps();

  const siteConfig = useMemo(
    () => getSettingsForSite(activeSite?.id),
    [getSettingsForSite, activeSite?.id]
  );

  const [inspectionResults, setInspectionResults] = useState({});
  const [inspectionRemarks, setInspectionRemarks] = useState({});
  const [inspectionPhotos, setInspectionPhotos] = useState({});

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
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");

  const [alert, setAlert] = useState({ isOpen: false });
  const showAlert = (title, message, type = "info") => setAlert({ isOpen: true, title, message, type, onConfirm: () => setAlert({ isOpen: false }) });

  const runningSeconds = useLiveTimer(machineRun?.started_at, !!machineRun);
  const operatorSeconds = useLiveTimer(workSession?.clock_in, workSession?.status === "active");
  const downtimeSeconds = useLiveTimer(downtime?.stopped_at, !!downtime);
  const openingMeter = machineRun ? Number(machineRun.start_hour_meter).toFixed(1) : Number(hourMeter).toFixed(1);
  const fuelMeterHint = machineRun ? openingMeter : openingMeter;

  const shiftDowntimeMin = useMemo(
    () => (machineRun ? shiftDowntimeMinutes(events, machineRun.id) : 0),
    [events, machineRun]
  );

  const prestartDone = useMemo(
    () => hasCompletedPrestart(
      inspections, user?.id, activeMachine?.id, workSession?.clock_in, siteConfig.prestart_items.length
    ),
    [inspections, user?.id, activeMachine?.id, workSession?.clock_in, siteConfig.prestart_items.length]
  );

  const inboxCount = useMemo(() =>
    issues.filter((i) => i.reporter_id === user?.id && i.status !== ISSUE.RESOLVED).length,
    [issues, user?.id]
  );

  const siteSupervisors = useMemo(
    () => getSiteSupervisors(profiles, activeSite?.id),
    [profiles, activeSite?.id]
  );

  const suggestedSupervisor = useMemo(
    () => suggestSupervisor(siteSupervisors, workSession?.clock_in ? new Date(workSession.clock_in) : new Date()),
    [siteSupervisors, workSession?.clock_in]
  );

  const blocked = machineBlocked && !machineRun && !downtime;

  const currentStep = useMemo(() => {
    if (submittedShift) return "end";
    if (machineRun || downtime) return "run";
    if (workSession && prestartDone) return "start";
    if (workSession) return "inspect";
    return "clock";
  }, [submittedShift, machineRun, downtime, workSession, prestartDone]);

  const handleClockIn = async () => {
    if (blocked) {
      showAlert("Machine In Use", `${machineBlocked.operator_name || "Another operator"} is running ${activeMachine?.name}.`, "warning");
      return;
    }
    try {
      await wf.clockIn(user, activeMachine, activeSite);
      await refreshLocal();
      showAlert("Clocked In", `Welcome ${user.name}! Complete pre-start inspection next.`, "success");
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
      setInspectionResults({});
      setInspectionRemarks({});
      setInspectionPhotos({});
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
      setInspectionResults({});
      setInspectionRemarks({});
      setInspectionPhotos({});
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
      await wf.stopMachine(user, activeMachine, activeSite, machineRun, { reason, note });
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
      await wf.restartMachine(user, activeMachine, activeSite, machineRun, downtime, { note: restartNote });
      setShowRestart(false); setRestartNote("");
      await refreshLocal();
      showAlert("Restarted", "Machine running again.", "success");
    } catch (e) { showAlert("Error", e.message, "error"); }
  };

  const handleEndDay = async () => {
    const sup = siteSupervisors.find((s) => s.id === selectedSupervisorId);
    if (!sup) {
      showAlert("Select Supervisor", "Choose who is supervising this shift.", "warning");
      return;
    }
    if (!endPhotoRef) {
      setEndPhotoError(true);
      showAlert("Photo Required", "Take a photo of the closing hour meter before submitting.", "warning");
      return;
    }
    try {
      const { ended } = await wf.endMachineDay(user, activeMachine, activeSite, machineRun, {
        endHour, photoRef: endPhotoRef, assignedSupervisor: sup,
      });
      if (workSession) await wf.clockOut(user, workSession, { note: "End of machine day" });
      setShowEndDay(false);
      setShowRestart(false);
      setShowStop(false);
      setEndHour(""); setEndPhotoRef(null); setEndPhotoPreview(null);
      setSelectedSupervisorId("");
      setSubmittedShift(ended);
      await refreshLocal();
    } catch (e) { showAlert("Error", e.message, "error"); }
  };

  const openEndDay = () => {
    if (suggestedSupervisor?.id) setSelectedSupervisorId(suggestedSupervisor.id);
    setShowEndDay(true);
  };

  const dismissSubmitted = () => setSubmittedShift(null);

  const headerContext = useMemo(() => {
    const parts = [activeSite?.name, activeMachine?.name].filter(Boolean);
    if (workSession) {
      parts.push(`${Math.floor(operatorSeconds / 3600)}h ${Math.floor((operatorSeconds % 3600) / 60)}m on site`);
    }
    return parts.join(" · ");
  }, [activeSite?.name, activeMachine?.name, workSession, operatorSeconds]);

  const machineStatus = machineRun ? "running" : downtime ? "stopped" : null;

  return (
    <AppPage
      subtitle="Operator"
      context={headerContext}
      showSite={false}
      maxWidth="max-w-2xl"
      alert={<AlertModal {...alert} confirmText="OK" />}
      banner={blocked && !submittedShift ? (
        <div className="bg-[#EF4444]/10 border-b border-[#EF4444]/30 px-4 py-2.5">
          <p className="font-logo text-[10px] text-[#EF4444] tracking-wider text-center">
            🔒 {machineBlocked.operator_name} is running {activeMachine?.name}
          </p>
        </div>
      ) : null}
    >
        <OperatorStepBar currentStep={currentStep} />

        {workSession && !submittedShift && (
          <OperatorActionBar
            inboxCount={inboxCount}
            onReport={() => setShowReportIssue(true)}
            onFuel={() => setShowFuel(true)}
            onInbox={() => setShowInbox(true)}
          />
        )}

        {machineStatus && (
          <div className={`mb-3 px-3 py-2 rounded-lg border text-center font-logo text-[10px] tracking-wider ${
            machineStatus === "running"
              ? "bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]"
              : "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]"
          }`}>
            {machineStatus === "running" ? "▶ MACHINE RUNNING" : `⏹ STOPPED — ${downtime?.reason || "Downtime"}`}
          </div>
        )}

        {/* Day complete — WhatsApp supervisor */}
        {submittedShift && (
          <div className="bg-[#141414] border-2 border-[#22C55E] rounded-2xl p-6 text-center">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="font-logo text-2xl text-[#22C55E] tracking-wider mb-2">Day Submitted</h2>
            <p className="font-body text-sm text-[#F2F0EA]/70 mb-1">
              Meter hours: {Number(submittedShift.hours_worked || 0).toFixed(1)}h ({submittedShift.start_hour_meter}h → {submittedShift.end_hour_meter}h)
            </p>
            {(submittedShift.runtime_minutes > 0 || submittedShift.downtime_minutes > 0) && (
              <p className="font-body text-xs text-[#F2F0EA]/45 mb-1">
                Runtime {Math.round(submittedShift.runtime_minutes || 0)}m · Downtime {Math.round(submittedShift.downtime_minutes || 0)}m
              </p>
            )}
            <p className="font-body text-xs text-[#F2F0EA]/50 mb-4">
              Clocked out · assigned to {submittedShift.assigned_supervisor_name || "supervisor"}
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

        {!submittedShift && (
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5 sm:p-6 shadow-lg">
            {!workSession && (
              <FormSection step={1} title="Clock in on site" description="Confirm you are on site and ready to begin today's shift." accent="#22C55E">
                <button type="button" onClick={handleClockIn} disabled={blocked}
                  className="w-full bg-[#22C55E] text-black py-5 rounded-2xl font-logo font-bold text-xl tracking-wider active:scale-95 disabled:opacity-40">
                  ⏱ CLOCK IN
                </button>
              </FormSection>
            )}

            {workSession && !prestartDone && !machineRun && !downtime && !blocked && (
              <>
                <PreStartInspectionChecklist
                  items={siteConfig.prestart_items}
                  statusOptions={siteConfig.prestart_status_options}
                  results={inspectionResults} remarks={inspectionRemarks} photos={inspectionPhotos}
                  setResults={setInspectionResults} setRemarks={setInspectionRemarks} setPhotos={setInspectionPhotos}
                  onComplete={handleInspection}
                />
                <button
                  type="button"
                  onClick={() => setShowEarlyClockOut(true)}
                  className="w-full mt-4 border border-[#2A2A2A] text-[#F2F0EA]/60 py-3 rounded-xl font-logo text-xs tracking-wider"
                >
                  CLOCK OUT — NOT STARTING TODAY
                </button>
              </>
            )}

            {workSession && blocked && !machineRun && !prestartDone && (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">🔒</div>
                <p className="font-body text-sm text-[#F2F0EA]/60 mb-4">{machineBlocked.operator_name} is running this machine.</p>
                <button
                  type="button"
                  onClick={() => setShowEarlyClockOut(true)}
                  className="w-full border border-[#2A2A2A] text-[#F2F0EA]/60 py-3 rounded-xl font-logo text-xs tracking-wider"
                >
                  CLOCK OUT — NOT STARTING TODAY
                </button>
              </div>
            )}

            {workSession && prestartDone && !machineRun && !downtime && !blocked && (
              <>
                <FormSection step={3} title="Opening hour meter" description={`Pre-start complete. Photo of meter is mandatory. Last verified reading: ${hourMeter}h.`} accent="#22C55E">
                  <MeterPhoto
                    value={startHour}
                    onValue={setStartHour}
                    photo={startPhotoPreview}
                    onPhoto={(ref, preview) => { setStartPhotoRef(ref); setStartPhotoPreview(preview); setStartPhotoError(false); }}
                    showPhotoError={startPhotoError}
                  />
                  <button type="button" onClick={handleStart} className="w-full mt-4 bg-[#22C55E] text-black py-5 rounded-2xl font-logo font-bold text-xl tracking-wider active:scale-95">
                    ▶ START MACHINE
                  </button>
                </FormSection>
                <button
                  type="button"
                  onClick={() => setShowEarlyClockOut(true)}
                  className="w-full mt-4 border border-[#2A2A2A] text-[#F2F0EA]/60 py-3 rounded-xl font-logo text-xs tracking-wider"
                >
                  CLOCK OUT — NOT STARTING TODAY
                </button>
              </>
            )}

            {machineRun && !downtime && (
              <FormSection step={4} title="Machine running" description="Billable hours come from meter at end of day — not this timer." accent="#22C55E">
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-[#141414] rounded-xl p-3 text-center">
                    <p className="font-logo text-[10px] text-[#F2F0EA]/50">OPENING METER</p>
                    <p className="font-logo text-2xl text-[#F5C518]">{openingMeter}h</p>
                  </div>
                  <div className="bg-[#141414] rounded-xl p-3 text-center">
                    <p className="font-logo text-[10px] text-[#F2F0EA]/50">RUNTIME (APP)</p>
                    <p className="font-logo text-2xl text-[#22C55E]">{formatDurationSeconds(runningSeconds)}</p>
                  </div>
                </div>
                {shiftDowntimeMin > 0 && (
                  <p className="font-body text-xs text-[#F2F0EA]/50 mb-3 text-center">Downtime this shift: {Math.round(shiftDowntimeMin)} min</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setShowStop(true)} className="bg-[#EF4444] text-white py-5 rounded-xl font-logo font-bold tracking-wider active:scale-95">⏹ STOP</button>
                  <button type="button" onClick={openEndDay} className="bg-[#F5C518] text-black py-5 rounded-xl font-logo font-bold tracking-wider active:scale-95">📋 END DAY</button>
                </div>
              </FormSection>
            )}

            {machineRun && downtime && (
              <FormSection step={4} title="Machine stopped" description={`Reason: ${downtime.reason}. Restart when ready, or End Day if shift is over.`} accent="#EF4444">
                <p className="font-logo text-2xl text-[#F2F0EA]/80 mb-4">{Math.floor(downtimeSeconds / 60)} min downtime</p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setShowRestart(true)} className="bg-[#22C55E] text-black py-4 rounded-xl font-logo font-bold active:scale-95">▶ RESTART</button>
                  <button type="button" onClick={openEndDay} className="bg-[#F5C518] text-black py-4 rounded-xl font-logo font-bold active:scale-95">📋 END DAY</button>
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
        <FuelModal onClose={() => setShowFuel(false)} currentMeter={fuelMeterHint} user={user} machine={activeMachine} site={activeSite} shiftId={machineRun?.id} onDone={refreshLocal} />
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
          <FormSection step={1} title="Supervisor on duty" description="Who will verify this shift today?" accent="#F5C518">
            <SupervisorPicker
              supervisors={siteSupervisors}
              value={selectedSupervisorId}
              onChange={setSelectedSupervisorId}
              suggestedId={suggestedSupervisor?.id}
            />
          </FormSection>
          <FormSection step={2} title="Closing hour meter" description="Photo of meter is mandatory. Enter reading from the photo." accent="#F5C518">
            <MeterPhoto
              value={endHour}
              onValue={setEndHour}
              photo={endPhotoPreview}
              onPhoto={(ref, preview) => { setEndPhotoRef(ref); setEndPhotoPreview(preview); setEndPhotoError(false); }}
              showPhotoError={endPhotoError}
            />
          </FormSection>
          <button type="button" onClick={handleEndDay} disabled={!selectedSupervisorId || !endHour || !endPhotoRef}
            className="w-full bg-[#F5C518] text-black py-4 rounded-xl font-logo font-bold disabled:opacity-40">
            SUBMIT & CLOCK OUT
          </button>
        </Modal>
      )}
    </AppPage>
  );
}
